import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  authedUser,
  closeTestPool,
  getApp,
  hasTestDatabase,
  makeTestImage,
  migrateTestDatabase,
  resetDatabase,
  seedArtwork,
} from '../helpers.js';
import { pool } from '../../database/pool.js';

const suite = hasTestDatabase ? describe : describe.skip;

suite('Painel administrativo', () => {
  beforeAll(async () => {
    await migrateTestDatabase();
  });

  afterAll(async () => {
    await closeTestPool();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  describe('autorização', () => {
    it('bloqueia usuários comuns em todas as rotas administrativas', async () => {
      const { token } = await authedUser({ role: 'USER' });

      const routes: Array<[string, string]> = [
        ['get', '/api/admin/stats'],
        ['get', '/api/admin/artworks'],
        ['get', '/api/admin/reward-rules'],
        ['get', '/api/admin/users'],
      ];

      for (const [method, path] of routes) {
        const response = await (request(getApp()) as never as Record<string, Function>)[method](
          path,
        ).set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('exige autenticação antes de verificar o papel', async () => {
      await request(getApp()).get('/api/admin/stats').expect(401);
    });

    it('permite acesso a administradores', async () => {
      const { token } = await authedUser({ role: 'ADMIN' });
      await request(getApp())
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('gestão de artes', () => {
    it('cadastra uma arte por upload, sem alteração de código', async () => {
      const { token } = await authedUser({ role: 'ADMIN' });
      const image = await makeTestImage(400, 300);

      const response = await request(getApp())
        .post('/api/admin/artworks')
        .set('Authorization', `Bearer ${token}`)
        .field('name', 'Kenai Aventureiro')
        .field('rarity', 'EPIC')
        .field('isActive', 'true')
        .attach('file', image, { filename: 'kenai.png', contentType: 'image/png' })
        .expect(201);

      expect(response.body.artwork.name).toBe('Kenai Aventureiro');
      expect(response.body.artwork.rarity).toBe('EPIC');
      expect(response.body.artwork.width).toBe(400);
      expect(response.body.artwork.height).toBe(300);

      // The storage key is generated server side: the uploaded filename is
      // never used as a path.
      const stored = await pool.query('SELECT storage_path FROM artworks WHERE id = $1', [
        response.body.artwork.id,
      ]);
      expect(stored.rows[0].storage_path).not.toContain('kenai.png');
      expect(stored.rows[0].storage_path).toMatch(/^artworks\/[0-9a-f-]+\.png$/);
    });

    it('a arte enviada fica imediatamente disponível para sorteio', async () => {
      const admin = await authedUser({ role: 'ADMIN' });
      const image = await makeTestImage();

      await request(getApp())
        .post('/api/admin/artworks')
        .set('Authorization', `Bearer ${admin.token}`)
        .field('name', 'Kenai Novo')
        .field('rarity', 'COMMON')
        .attach('file', image, { filename: 'novo.png', contentType: 'image/png' })
        .expect(201);

      const player = await authedUser();
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

      // With no other artwork in the catalogue, the new upload must be drawn.
      const goal = await request(getApp())
        .post('/api/goals')
        .set('Authorization', `Bearer ${player.token}`)
        .send({ title: 'Sorteio imediato', durationDays: 7, startDate: today })
        .expect(201);

      const assigned = await pool.query(
        'SELECT a.name FROM goals g JOIN artworks a ON a.id = g.artwork_id WHERE g.id = $1',
        [goal.body.goal.id],
      );
      expect(assigned.rows[0].name).toBe('Kenai Novo');
    });

    it('recusa arquivos que não são imagens', async () => {
      const { token } = await authedUser({ role: 'ADMIN' });

      // An executable renamed to .png, declared as image/png.
      const fake = Buffer.from('#!/bin/sh\necho "não sou uma imagem"\n');

      const response = await request(getApp())
        .post('/api/admin/artworks')
        .set('Authorization', `Bearer ${token}`)
        .field('name', 'Arquivo falso')
        .field('rarity', 'COMMON')
        .attach('file', fake, { filename: 'malicioso.png', contentType: 'image/png' })
        .expect(422);

      expect(response.body.error.code).toBe('UPLOAD_INVALID');

      const count = await pool.query('SELECT count(*)::int AS total FROM artworks');
      expect(count.rows[0].total).toBe(0);
    });

    it('recusa tipos MIME não permitidos', async () => {
      const { token } = await authedUser({ role: 'ADMIN' });

      await request(getApp())
        .post('/api/admin/artworks')
        .set('Authorization', `Bearer ${token}`)
        .field('name', 'Script')
        .field('rarity', 'COMMON')
        .attach('file', Buffer.from('alert(1)'), {
          filename: 'script.js',
          contentType: 'application/javascript',
        })
        .expect(422);
    });

    it('desativa uma arte sem quebrar colecionáveis existentes', async () => {
      const { token } = await authedUser({ role: 'ADMIN' });
      const artwork = await seedArtwork();

      await request(getApp())
        .patch(`/api/admin/artworks/${artwork.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false })
        .expect(200);

      const row = await pool.query('SELECT is_active FROM artworks WHERE id = $1', [artwork.id]);
      expect(row.rows[0].is_active).toBe(false);
    });

    it('impede excluir uma arte já usada em metas', async () => {
      const admin = await authedUser({ role: 'ADMIN' });
      const artwork = await seedArtwork();
      const player = await authedUser();

      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

      await request(getApp())
        .post('/api/goals')
        .set('Authorization', `Bearer ${player.token}`)
        .send({ title: 'Usa a arte', durationDays: 7, startDate: today })
        .expect(201);

      const response = await request(getApp())
        .delete(`/api/admin/artworks/${artwork.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(409);

      expect(response.body.error.code).toBe('ARTWORK_IN_USE');
    });

    it('permite excluir uma arte que nunca foi usada', async () => {
      const { token } = await authedUser({ role: 'ADMIN' });
      const artwork = await seedArtwork();

      await request(getApp())
        .delete(`/api/admin/artworks/${artwork.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const count = await pool.query('SELECT count(*)::int AS total FROM artworks');
      expect(count.rows[0].total).toBe(0);
    });
  });

  describe('regras de recompensa', () => {
    it('lista as regras padrão com pesos normalizados', async () => {
      const { token } = await authedUser({ role: 'ADMIN' });
      await seedArtwork({ rarity: 'COMMON' });

      const response = await request(getApp())
        .get('/api/admin/reward-rules')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.rules.length).toBeGreaterThanOrEqual(6);

      const yearRule = response.body.rules.find(
        (rule: { minDays: number }) => rule.minDays === 365,
      );
      expect(yearRule.weights[0].rarity).toBe('LEGENDARY');
    });

    it('cria e atualiza uma regra sem precisar de deploy', async () => {
      const { token } = await authedUser({ role: 'ADMIN' });

      const created = await request(getApp())
        .post('/api/admin/reward-rules')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Regra personalizada',
          minDays: 20,
          maxDays: 25,
          priority: 500,
          isActive: true,
          weights: [
            { rarity: 'RARE', weight: 70 },
            { rarity: 'EPIC', weight: 30 },
          ],
        })
        .expect(201);

      expect(created.body.rule.weights).toHaveLength(2);

      const updated = await request(getApp())
        .patch(`/api/admin/reward-rules/${created.body.rule.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ weights: [{ rarity: 'LEGENDARY', weight: 100 }] })
        .expect(200);

      expect(updated.body.rule.weights).toHaveLength(1);
      expect(updated.body.rule.weights[0].rarity).toBe('LEGENDARY');
    });

    it('recusa faixas invertidas e pesos todos zerados', async () => {
      const { token } = await authedUser({ role: 'ADMIN' });

      await request(getApp())
        .post('/api/admin/reward-rules')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Invertida',
          minDays: 60,
          maxDays: 30,
          weights: [{ rarity: 'RARE', weight: 10 }],
        })
        .expect(400);

      await request(getApp())
        .post('/api/admin/reward-rules')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Sem peso',
          minDays: 30,
          maxDays: 60,
          weights: [{ rarity: 'RARE', weight: 0 }],
        })
        .expect(400);
    });

    it('mostra a chance real considerando pools vazios', async () => {
      const { token } = await authedUser({ role: 'ADMIN' });
      // Only COMMON is stocked, so the 7-14 rule must resolve to 100% COMMON.
      await seedArtwork({ rarity: 'COMMON' });

      const response = await request(getApp())
        .get('/api/admin/reward-rules/preview?durationDays=10')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const common = response.body.chances.find(
        (chance: { rarity: string }) => chance.rarity === 'COMMON',
      );
      const uncommon = response.body.chances.find(
        (chance: { rarity: string }) => chance.rarity === 'UNCOMMON',
      );

      expect(common.normalisedPercent).toBe(100);
      expect(uncommon.normalisedPercent).toBe(0);
      expect(uncommon.activeArtworks).toBe(0);
    });
  });

  describe('gestão de usuários', () => {
    it('promove um usuário a administrador', async () => {
      const admin = await authedUser({ role: 'ADMIN' });
      const target = await authedUser();

      const response = await request(getApp())
        .patch(`/api/admin/users/${target.user.id}/role`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ role: 'ADMIN' })
        .expect(200);

      expect(response.body.user.role).toBe('ADMIN');
    });

    it('impede remover o último administrador', async () => {
      const admin = await authedUser({ role: 'ADMIN' });
      const other = await authedUser({ role: 'ADMIN' });

      // Self-demotion is always refused.
      const self = await request(getApp())
        .patch(`/api/admin/users/${admin.user.id}/role`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ role: 'USER' })
        .expect(409);
      expect(self.body.error.code).toBe('LAST_ADMIN');

      // Demoting another admin is fine while one remains.
      await request(getApp())
        .patch(`/api/admin/users/${other.user.id}/role`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ role: 'USER' })
        .expect(200);

      // Now only one admin is left, and they cannot demote themselves.
      await request(getApp())
        .patch(`/api/admin/users/${admin.user.id}/role`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ role: 'USER' })
        .expect(409);

      const admins = await pool.query(
        `SELECT count(*)::int AS total FROM users WHERE role = 'ADMIN'`,
      );
      expect(admins.rows[0].total).toBe(1);
    });
  });
});
