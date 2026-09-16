/**
 * Development seed.
 *
 * Registers the initial Kenai artwork by UPLOADING it through the same storage
 * abstraction the admin panel uses. That matters: the seed is not a special
 * case wired to a local path — it exercises the production code path, so
 * switching STORAGE_DRIVER to `supabase` makes the seed populate Supabase
 * Storage with no code change.
 *
 * Everything else an admin would add later goes through the admin panel. There
 * are deliberately no fake artworks here.
 *
 *   npm run seed
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { closePool } from './pool.js';
import { logger } from '../utils/logger.js';
import { getStorageProvider } from '../storage/index.js';
import { inspectImage } from '../services/imageCompositor.js';
import * as artworkRepository from '../repositories/artworkRepository.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** The initial development collectible. */
const INITIAL_ARTWORK = {
  name: 'Kenai na Praia',
  description: 'A primeira arte do Kenai. Procure a estrela escondida.',
  // A short goal is the quickest way to exercise the whole loop end to end,
  // so the test artwork sits in the rarity those goals actually draw from.
  rarity: 'COMMON' as const,
};

async function seedInitialArtwork(): Promise<void> {
  const existing = await artworkRepository.listArtworks({ search: INITIAL_ARTWORK.name });
  if (existing.some((artwork) => artwork.name === INITIAL_ARTWORK.name)) {
    logger.info('Arte inicial já cadastrada. Nada a fazer.');
    return;
  }

  const sourcePath = path.resolve(
    repoRoot,
    env.SEED_ARTWORK_PATH ?? './client/public/brand/Kenai/KenPraia.png',
  );

  let fileBuffer: Buffer;
  try {
    fileBuffer = await fs.readFile(sourcePath);
  } catch {
    logger.warn(
      { expectedPath: sourcePath },
      'Arquivo KenPraia.png não encontrado. ' +
        'Adicione a arte oficial em client/public/brand/Kenai/KenPraia.png e rode o seed novamente, ' +
        'ou cadastre a primeira arte pelo painel administrativo em /admin/artes.',
    );
    return;
  }

  const inspected = await inspectImage(fileBuffer);
  const storage = getStorageProvider();
  const storagePath = `artworks/${randomUUID()}.png`;

  const stored = await storage.upload({
    path: storagePath,
    body: fileBuffer,
    contentType: 'image/png',
  });

  await artworkRepository.createArtwork({
    name: INITIAL_ARTWORK.name,
    description: INITIAL_ARTWORK.description,
    rarity: INITIAL_ARTWORK.rarity,
    storageBucket: stored.bucket,
    storagePath: stored.path,
    width: inspected.width,
    height: inspected.height,
    mimeType: 'image/png',
    byteSize: fileBuffer.byteLength,
    isActive: true,
    createdBy: null,
  });

  logger.info(
    { name: INITIAL_ARTWORK.name, driver: storage.driver, bucket: stored.bucket },
    'Arte inicial cadastrada',
  );
}

async function main(): Promise<void> {
  // Reward rules ship as migration 002, so a seeded database is immediately
  // able to award rewards.
  await seedInitialArtwork();
  logger.info('Seed concluído.');
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (error: unknown) => {
    logger.error({ err: error }, 'Falha ao executar o seed');
    await closePool().catch(() => undefined);
    process.exit(1);
  });
