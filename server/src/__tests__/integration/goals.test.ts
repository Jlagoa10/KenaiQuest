import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MAX_ACTIVE_GOALS } from '@kenai/shared';
import {
  authedUser,
  closeTestPool,
  forceCompleteDays,
  getApp,
  hasTestDatabase,
  migrateTestDatabase,
  resetDatabase,
  seedArtwork,
  seedArtworkForEveryRarity,
  shiftGoalBackByDays,
} from '../helpers.js';
import { pool } from '../../database/pool.js';

const suite = hasTestDatabase ? describe : describe.skip;

/** Today in the test user's timezone, which is what the API validates against. */
function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

suite('Metas', () => {
  beforeAll(async () => {
    await migrateTestDatabase();
  });

  afterAll(async () => {
    await closeTestPool();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  describe('criação', () => {
    it('cria uma meta e gera exatamente um dia por peça', async () => {
      await seedArtwork();
      const { token } = await authedUser();

      const response = await request(getApp())
        .post('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Correr todo dia', durationDays: 30, startDate: todayInSaoPaulo() })
        .expect(201);

      expect(response.body.goal.totalPieces).toBe(30);
      expect(response.body.goal.durationDays).toBe(30);

      const days = await pool.query('SELECT * FROM goal_days WHERE goal_id = $1', [
        response.body.goal.id,
      ]);
      expect(days.rowCount).toBe(30);

      // The reveal order is a stored permutation: every piece exactly once.
      const pieceIndexes = days.rows.map((row) => row.piece_index).sort((a, b) => a - b);
      expect(pieceIndexes).toEqual(Array.from({ length: 30 }, (_, i) => i));
    });

    it('NÃO revela a arte secreta enquanto a meta está ativa', async () => {
      const artwork = await seedArtwork({ name: 'Kenai Secreto', rarity: 'RARE' });
      const { token } = await authedUser();

      const created = await request(getApp())
        .post('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Meta secreta', durationDays: 7, startDate: todayInSaoPaulo() })
        .expect(201);

      const detail = await request(getApp())
        .get(`/api/goals/${created.body.goal.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // The whole serialised payload must not leak identity, rarity or storage path.
      const payload = JSON.stringify(detail.body);
      expect(detail.body.goal.artwork).toBeUndefined();
      expect(payload).not.toContain('Kenai Secreto');
      expect(payload).not.toContain('RARE');
      expect(payload).not.toContain(artwork.storagePath);
      expect(payload).not.toContain(artwork.id);
    });

    it('informa quais peças já foram reveladas, para o card poder desenhá-las', async () => {
      await seedArtwork();
      const { token } = await authedUser();

      const created = await request(getApp())
        .post('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Peças reveladas', durationDays: 10, startDate: todayInSaoPaulo() })
        .expect(201);
      const goalId = created.body.goal.id as string;

      // A brand new goal has nothing revealed yet.
      expect(created.body.goal.revealedPieceIndexes).toEqual([]);
      expect(created.body.goal.missedPieceIndexes).toEqual([]);

      await request(getApp())
        .post(`/api/goals/${goalId}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({ target: 'today' })
        .expect(200);

      const list = await request(getApp())
        .get('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const summary = list.body.goals.find((goal: { id: string }) => goal.id === goalId);
      // Without this the dashboard would cover the artwork with a full overlay.
      expect(summary.revealedPieceIndexes).toHaveLength(1);
      expect(summary.revealedPieceIndexes[0]).toBeGreaterThanOrEqual(0);
      expect(summary.revealedPieceIndexes[0]).toBeLessThan(10);
    });

    it('bloqueia a quarta meta ativa', async () => {
      await seedArtwork();
      const { token } = await authedUser();

      for (let i = 0; i < MAX_ACTIVE_GOALS; i += 1) {
        await request(getApp())
          .post('/api/goals')
          .set('Authorization', `Bearer ${token}`)
          .send({ title: `Meta ${i + 1}`, durationDays: 7, startDate: todayInSaoPaulo() })
          .expect(201);
      }

      const blocked = await request(getApp())
        .post('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Meta demais', durationDays: 7, startDate: todayInSaoPaulo() })
        .expect(409);

      expect(blocked.body.error.code).toBe('ACTIVE_GOAL_LIMIT');
      expect(blocked.body.error.message).toBe('Você pode ter no máximo 3 metas ativas.');
    });

    it('aplica o limite de metas ativas mesmo com requisições simultâneas', async () => {
      await seedArtwork();
      const { token } = await authedUser();

      // Five concurrent creations; the advisory lock must let exactly three through.
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, (_, i) =>
          request(getApp())
            .post('/api/goals')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: `Simultânea ${i}`, durationDays: 7, startDate: todayInSaoPaulo() }),
        ),
      );

      const created = results.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 201,
      );
      expect(created).toHaveLength(MAX_ACTIVE_GOALS);

      const active = await pool.query(
        `SELECT count(*)::int AS total FROM goals WHERE status = 'ACTIVE'`,
      );
      expect(active.rows[0].total).toBe(MAX_ACTIVE_GOALS);
    });

    it('rejeita durações fora do intervalo de 7 a 365 dias', async () => {
      await seedArtwork();
      const { token } = await authedUser();

      for (const durationDays of [6, 0, -5, 366, 1000]) {
        await request(getApp())
          .post('/api/goals')
          .set('Authorization', `Bearer ${token}`)
          .send({ title: 'Duração inválida', durationDays, startDate: todayInSaoPaulo() })
          .expect(400);
      }
    });

    it('aceita qualquer duração inteira válida, não apenas valores predefinidos', async () => {
      await seedArtwork();

      for (const durationDays of [7, 12, 31, 45, 187, 365]) {
        const { token } = await authedUser();
        const response = await request(getApp())
          .post('/api/goals')
          .set('Authorization', `Bearer ${token}`)
          .send({ title: `Meta de ${durationDays}`, durationDays, startDate: todayInSaoPaulo() })
          .expect(201);
        expect(response.body.goal.totalPieces).toBe(durationDays);
      }
    });

    it('rejeita data de início no passado e aceita data futura', async () => {
      await seedArtwork();
      const { token } = await authedUser();
      const today = todayInSaoPaulo();

      const past = await request(getApp())
        .post('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'No passado', durationDays: 7, startDate: addDays(today, -1) })
        .expect(400);
      expect(past.body.error.code).toBe('INVALID_START_DATE');

      await request(getApp())
        .post('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'No futuro', durationDays: 7, startDate: addDays(today, 10) })
        .expect(201);
    });

    it('garante raridade Lendária para metas de 365 dias', async () => {
      await seedArtworkForEveryRarity();

      // Repeated to make a weighted-draw fluke implausible.
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const { token } = await authedUser();
        const created = await request(getApp())
          .post('/api/goals')
          .set('Authorization', `Bearer ${token}`)
          .send({ title: 'Um ano inteiro', durationDays: 365, startDate: todayInSaoPaulo() })
          .expect(201);

        const row = await pool.query(
          `SELECT a.rarity FROM goals g JOIN artworks a ON a.id = g.artwork_id WHERE g.id = $1`,
          [created.body.goal.id],
        );
        expect(row.rows[0].rarity).toBe('LEGENDARY');
      }
    });

    it('retorna erro amigável quando não há nenhuma arte ativa', async () => {
      await seedArtwork({ isActive: false });
      const { token } = await authedUser();

      const response = await request(getApp())
        .post('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Sem arte', durationDays: 7, startDate: todayInSaoPaulo() })
        .expect(503);

      expect(response.body.error.code).toBe('NO_ARTWORK_AVAILABLE');
    });
  });

  describe('conclusão diária', () => {
    async function createGoal(token: string, durationDays = 10) {
      const response = await request(getApp())
        .post('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Meta diária', durationDays, startDate: todayInSaoPaulo() })
        .expect(201);
      return response.body.goal.id as string;
    }

    it('conclui o dia de hoje e revela exatamente uma peça', async () => {
      await seedArtwork();
      const { token } = await authedUser();
      const goalId = await createGoal(token);

      const response = await request(getApp())
        .post(`/api/goals/${goalId}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({ target: 'today' })
        .expect(200);

      expect(response.body.goal.progress.completedDays).toBe(1);
      expect(typeof response.body.revealedPieceIndex).toBe('number');
    });

    it('impede concluir o mesmo dia duas vezes', async () => {
      await seedArtwork();
      const { token } = await authedUser();
      const goalId = await createGoal(token);

      await request(getApp())
        .post(`/api/goals/${goalId}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({ target: 'today' })
        .expect(200);

      const duplicate = await request(getApp())
        .post(`/api/goals/${goalId}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({ target: 'today' })
        .expect(409);

      expect(duplicate.body.error.code).toBe('DAY_ALREADY_COMPLETED');
    });

    it('permite concluir ontem, mas não anteontem', async () => {
      await seedArtwork();
      const { token } = await authedUser();
      const goalId = await createGoal(token);

      // Shift the goal back two days: day 1 is now two days ago (unreachable),
      // day 2 is yesterday (still claimable) and day 3 is today.
      await shiftGoalBackByDays(goalId, 2);

      await request(getApp())
        .post(`/api/goals/${goalId}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({ target: 'yesterday' })
        .expect(200);

      const days = await pool.query(
        'SELECT day_number, status FROM goal_days WHERE goal_id = $1 ORDER BY day_number',
        [goalId],
      );
      // Day 1 fell outside the grace window and is permanently missed.
      expect(days.rows[0].status).toBe('MISSED');
      expect(days.rows[1].status).toBe('COMPLETED');
    });

    it('só aceita os alvos hoje e ontem', async () => {
      await seedArtwork();
      const { token } = await authedUser();
      const goalId = await createGoal(token);

      for (const target of ['2020-01-01', 'tomorrow', 'anteontem', '']) {
        await request(getApp())
          .post(`/api/goals/${goalId}/complete`)
          .set('Authorization', `Bearer ${token}`)
          .send({ target })
          .expect(400);
      }
    });

    it('marca dias vencidos como perdidos de forma permanente', async () => {
      await seedArtwork();
      const { token } = await authedUser();
      const goalId = await createGoal(token, 10);

      await shiftGoalBackByDays(goalId, 5);

      await request(getApp())
        .get(`/api/goals/${goalId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const missed = await pool.query(
        `SELECT count(*)::int AS total FROM goal_days WHERE goal_id = $1 AND status = 'MISSED'`,
        [goalId],
      );
      // Days 1 to 4 expired; day 5 is yesterday and day 6 is today.
      expect(missed.rows[0].total).toBe(4);

      // Resolution is idempotent: asking again changes nothing.
      await request(getApp())
        .get(`/api/goals/${goalId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const again = await pool.query(
        `SELECT count(*)::int AS total FROM goal_days WHERE goal_id = $1 AND status = 'MISSED'`,
        [goalId],
      );
      expect(again.rows[0].total).toBe(4);
    });

    it('não permite concluir a meta de outra pessoa', async () => {
      await seedArtwork();
      const owner = await authedUser();
      const stranger = await authedUser();
      const goalId = await createGoal(owner.token);

      await request(getApp())
        .post(`/api/goals/${goalId}/complete`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ target: 'today' })
        .expect(403);
    });
  });

  describe('encerramento', () => {
    it('gera o colecionável mesmo incompleto e revela a arte', async () => {
      await seedArtwork({ name: 'Kenai na Praia' });
      const { token } = await authedUser();

      const created = await request(getApp())
        .post('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Trinta dias', durationDays: 30, startDate: todayInSaoPaulo() })
        .expect(201);
      const goalId = created.body.goal.id as string;

      await forceCompleteDays(goalId, Array.from({ length: 27 }, (_, i) => i + 1));
      await shiftGoalBackByDays(goalId, 40);

      const detail = await request(getApp())
        .get(`/api/goals/${goalId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(detail.body.goal.status).toBe('COMPLETED');
      // Identity is revealed only now that the goal has ended.
      expect(detail.body.goal.artwork.name).toBe('Kenai na Praia');

      const collectible = await pool.query('SELECT * FROM collectibles WHERE source_goal_id = $1', [
        goalId,
      ]);
      expect(collectible.rowCount).toBe(1);
      expect(collectible.rows[0].pieces_obtained).toBe(27);
      expect(collectible.rows[0].total_pieces).toBe(30);
      expect(Number(collectible.rows[0].completion_percent)).toBe(90);
      expect(collectible.rows[0].is_perfect).toBe(false);
    });

    it('marca cópia perfeita quando todos os dias são concluídos', async () => {
      await seedArtwork();
      const { token } = await authedUser();

      const created = await request(getApp())
        .post('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Perfeita', durationDays: 7, startDate: todayInSaoPaulo() })
        .expect(201);
      const goalId = created.body.goal.id as string;

      await forceCompleteDays(goalId, [1, 2, 3, 4, 5, 6, 7]);
      await shiftGoalBackByDays(goalId, 10);

      await request(getApp())
        .get(`/api/goals/${goalId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const collectible = await pool.query('SELECT * FROM collectibles WHERE source_goal_id = $1', [
        goalId,
      ]);
      expect(collectible.rows[0].is_perfect).toBe(true);
      expect(Number(collectible.rows[0].completion_percent)).toBe(100);
    });

    it('cria apenas um colecionável mesmo com acessos simultâneos', async () => {
      await seedArtwork();
      const { token } = await authedUser();

      const created = await request(getApp())
        .post('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Corrida', durationDays: 7, startDate: todayInSaoPaulo() })
        .expect(201);
      const goalId = created.body.goal.id as string;

      await forceCompleteDays(goalId, [1, 2, 3, 4, 5]);
      await shiftGoalBackByDays(goalId, 10);

      await Promise.allSettled(
        Array.from({ length: 6 }, () =>
          request(getApp()).get(`/api/goals/${goalId}`).set('Authorization', `Bearer ${token}`),
        ),
      );

      const collectible = await pool.query(
        'SELECT count(*)::int AS total FROM collectibles WHERE source_goal_id = $1',
        [goalId],
      );
      expect(collectible.rows[0].total).toBe(1);
    });

    it('não concede colecionável quando a meta é excluída', async () => {
      await seedArtwork();
      const { token } = await authedUser();

      const created = await request(getApp())
        .post('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Vou desistir', durationDays: 7, startDate: todayInSaoPaulo() })
        .expect(201);
      const goalId = created.body.goal.id as string;

      await request(getApp())
        .post(`/api/goals/${goalId}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({ target: 'today' })
        .expect(200);

      await request(getApp())
        .delete(`/api/goals/${goalId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const collectibles = await pool.query(
        'SELECT count(*)::int AS total FROM collectibles WHERE source_goal_id = $1',
        [goalId],
      );
      expect(collectibles.rows[0].total).toBe(0);

      const goal = await pool.query('SELECT status FROM goals WHERE id = $1', [goalId]);
      expect(goal.rows[0].status).toBe('CANCELLED');

      // Cancelling frees an active slot.
      const active = await pool.query(
        `SELECT count(*)::int AS total FROM goals WHERE status = 'ACTIVE'`,
      );
      expect(active.rows[0].total).toBe(0);
    });
  });

  describe('imagem revelada', () => {
    it('entrega apenas as peças já desbloqueadas', async () => {
      await seedArtwork();
      const { token } = await authedUser();

      const created = await request(getApp())
        .post('/api/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Imagem', durationDays: 7, startDate: todayInSaoPaulo() })
        .expect(201);
      const goalId = created.body.goal.id as string;

      const before = await request(getApp())
        .get(`/api/goals/${goalId}/image.png`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(before.headers['content-type']).toBe('image/png');

      await request(getApp())
        .post(`/api/goals/${goalId}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({ target: 'today' })
        .expect(200);

      const after = await request(getApp())
        .get(`/api/goals/${goalId}/image.png`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Revealing a piece changes both the bytes and the cache validator.
      expect(after.headers.etag).not.toBe(before.headers.etag);
      expect(after.body.length).toBeGreaterThan(before.body.length);
    });

    it('não entrega a imagem da meta de outra pessoa', async () => {
      await seedArtwork();
      const owner = await authedUser();
      const stranger = await authedUser();

      const created = await request(getApp())
        .post('/api/goals')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'Privada', durationDays: 7, startDate: todayInSaoPaulo() })
        .expect(201);

      await request(getApp())
        .get(`/api/goals/${created.body.goal.id}/image.png`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(403);
    });
  });
});
