import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { Express } from 'express';
import request from 'supertest';
import type { Rarity } from '@kenai/shared';
import { pool } from '../database/pool.js';
import { getStorageProvider } from '../storage/index.js';
import { createApp } from '../app.js';
import { hashPassword } from '../services/authService.js';
import * as userRepository from '../repositories/userRepository.js';
import * as artworkRepository from '../repositories/artworkRepository.js';
import { clearImageCaches } from '../services/imageCompositor.js';
import type { ArtworkRecord, UserRecord } from '../types/models.js';

export const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

let app: Express | null = null;

export function getApp(): Express {
  app ??= createApp();
  return app;
}

/** Applies the migration files to the test database. */
export async function migrateTestDatabase(): Promise<void> {
  const { runMigrations } = await import('../database/migrate.js');
  await runMigrations();
}

/**
 * Wipes application data between tests while preserving the schema and the
 * reward rules that ship as migration 002.
 */
export async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE trades, trade_offers, collectibles, goal_days, goals,
             artworks, refresh_tokens, users
    RESTART IDENTITY CASCADE
  `);
  clearImageCaches();
}

export async function createTestUser(
  overrides: Partial<{ name: string; email: string; password: string; timezone: string; role: 'USER' | 'ADMIN' }> = {},
): Promise<{ user: UserRecord; password: string }> {
  const password = overrides.password ?? 'senhaSegura123';
  const user = await userRepository.createUser({
    name: overrides.name ?? 'Pessoa de Teste',
    email: overrides.email ?? `user-${randomUUID()}@exemplo.com`,
    passwordHash: await hashPassword(password),
    timezone: overrides.timezone ?? 'America/Sao_Paulo',
    ...(overrides.role ? { role: overrides.role } : {}),
  });
  return { user, password };
}

/** Signs in through the real HTTP endpoint so tests exercise the auth stack. */
export async function loginAs(email: string, password: string): Promise<string> {
  const response = await request(getApp())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);
  return response.body.accessToken as string;
}

export async function authedUser(
  overrides: Parameters<typeof createTestUser>[0] = {},
): Promise<{ user: UserRecord; token: string }> {
  const { user, password } = await createTestUser(overrides);
  const token = await loginAs(user.email, password);
  return { user, token };
}

/**
 * Generates a small synthetic image for tests.
 *
 * This is NOT brand artwork — it is a throwaway gradient used only to exercise
 * upload validation and the piece compositor.
 */
export async function makeTestImage(width = 300, height = 200): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 60, g: 90, b: 140 } },
  })
    .png()
    .toBuffer();
}

export async function seedArtwork(
  overrides: Partial<{ name: string; rarity: Rarity; isActive: boolean }> = {},
): Promise<ArtworkRecord> {
  const buffer = await makeTestImage();
  const storage = getStorageProvider();
  const storagePath = `artworks/${randomUUID()}.png`;
  const stored = await storage.upload({
    path: storagePath,
    body: buffer,
    contentType: 'image/png',
  });

  return artworkRepository.createArtwork({
    name: overrides.name ?? 'Kenai de Teste',
    description: null,
    rarity: overrides.rarity ?? 'COMMON',
    storageBucket: stored.bucket,
    storagePath: stored.path,
    width: 300,
    height: 200,
    mimeType: 'image/png',
    byteSize: buffer.byteLength,
    isActive: overrides.isActive ?? true,
    createdBy: null,
  });
}

/** Ensures every rarity has a drawable artwork, for reward engine tests. */
export async function seedArtworkForEveryRarity(): Promise<Record<Rarity, ArtworkRecord>> {
  const rarities: Rarity[] = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];
  const result = {} as Record<Rarity, ArtworkRecord>;
  for (const rarity of rarities) {
    result[rarity] = await seedArtwork({ name: `Kenai ${rarity}`, rarity });
  }
  return result;
}

/**
 * Shifts a goal and its days backwards in time, simulating the passage of days
 * without waiting. Used to drive missed-day and finalisation tests.
 */
export async function shiftGoalBackByDays(goalId: string, days: number): Promise<void> {
  await pool.query(
    `UPDATE goals
     SET start_date = start_date - ($2 || ' days')::interval,
         end_date   = end_date   - ($2 || ' days')::interval
     WHERE id = $1`,
    [goalId, String(days)],
  );
  await pool.query(
    `UPDATE goal_days
     SET day_date = day_date - ($2 || ' days')::interval
     WHERE goal_id = $1`,
    [goalId, String(days)],
  );
}

/** Marks a set of goal days complete directly, bypassing the claim window. */
export async function forceCompleteDays(goalId: string, dayNumbers: number[]): Promise<void> {
  await pool.query(
    `UPDATE goal_days SET status = 'COMPLETED', completed_at = now()
     WHERE goal_id = $1 AND day_number = ANY($2::int[])`,
    [goalId, dayNumbers],
  );
}

export async function closeTestPool(): Promise<void> {
  await pool.end();
}
