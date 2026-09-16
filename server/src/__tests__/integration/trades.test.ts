import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  authedUser,
  closeTestPool,
  getApp,
  hasTestDatabase,
  migrateTestDatabase,
  resetDatabase,
  seedArtwork,
} from '../helpers.js';
import { pool } from '../../database/pool.js';
import type { UserRecord } from '../../types/models.js';

const suite = hasTestDatabase ? describe : describe.skip;

/**
 * Mints a collectible directly.
 * Trade rules are what these tests exercise, so the goal loop that produces a
 * collectible is short-circuited here; goals.test.ts covers that path.
 */
async function mintCollectible(params: {
  owner: UserRecord;
  artworkId: string;
  piecesObtained: number;
  totalPieces: number;
  listed?: boolean;
}): Promise<string> {
  const owned = Array.from({ length: params.piecesObtained }, (_, i) => i);
  const result = await pool.query(
    `INSERT INTO collectibles
       (owner_id, earned_by_user_id, artwork_id, goal_title, total_pieces,
        pieces_obtained, owned_piece_indexes, is_listed_for_trade)
     VALUES ($1, $1, $2, $3, $4, $5, $6::int[], $7)
     RETURNING id`,
    [
      params.owner.id,
      params.artworkId,
      'Meta de teste',
      params.totalPieces,
      params.piecesObtained,
      owned,
      params.listed ?? false,
    ],
  );
  return result.rows[0].id as string;
}

suite('Trocas', () => {
  beforeAll(async () => {
    await migrateTestDatabase();
  });

  afterAll(async () => {
    await closeTestPool();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  describe('elegibilidade', () => {
    it('permite listar uma cópia com 90% e recusa 89%', async () => {
      const artwork = await seedArtwork();
      const { user, token } = await authedUser();

      const eligible = await mintCollectible({
        owner: user,
        artworkId: artwork.id,
        piecesObtained: 90,
        totalPieces: 100,
      });
      const ineligible = await mintCollectible({
        owner: user,
        artworkId: artwork.id,
        piecesObtained: 89,
        totalPieces: 100,
      });

      await request(getApp())
        .patch(`/api/collectibles/${eligible}/listing`)
        .set('Authorization', `Bearer ${token}`)
        .send({ listed: true })
        .expect(200);

      const rejected = await request(getApp())
        .patch(`/api/collectibles/${ineligible}/listing`)
        .set('Authorization', `Bearer ${token}`)
        .send({ listed: true })
        .expect(422);

      expect(rejected.body.error.code).toBe('COLLECTIBLE_NOT_TRADABLE');
    });

    it('impede oferecer uma cópia abaixo de 90%', async () => {
      const artwork = await seedArtwork();
      const proposer = await authedUser();
      const receiver = await authedUser();

      const weak = await mintCollectible({
        owner: proposer.user,
        artworkId: artwork.id,
        piecesObtained: 80,
        totalPieces: 100,
      });
      const target = await mintCollectible({
        owner: receiver.user,
        artworkId: artwork.id,
        piecesObtained: 100,
        totalPieces: 100,
        listed: true,
      });

      const response = await request(getApp())
        .post('/api/trades/offers')
        .set('Authorization', `Bearer ${proposer.token}`)
        .send({ offeredCollectibleId: weak, requestedCollectibleId: target })
        .expect(422);

      expect(response.body.error.code).toBe('COLLECTIBLE_NOT_TRADABLE');
    });
  });

  describe('propriedade', () => {
    it('impede oferecer um colecionável que não é seu', async () => {
      const artwork = await seedArtwork();
      const proposer = await authedUser();
      const receiver = await authedUser();

      const notMine = await mintCollectible({
        owner: receiver.user,
        artworkId: artwork.id,
        piecesObtained: 100,
        totalPieces: 100,
      });
      const target = await mintCollectible({
        owner: receiver.user,
        artworkId: artwork.id,
        piecesObtained: 95,
        totalPieces: 100,
        listed: true,
      });

      const response = await request(getApp())
        .post('/api/trades/offers')
        .set('Authorization', `Bearer ${proposer.token}`)
        .send({ offeredCollectibleId: notMine, requestedCollectibleId: target })
        .expect(403);

      expect(response.body.error.code).toBe('NOT_COLLECTIBLE_OWNER');
    });

    it('impede trocar consigo mesmo', async () => {
      const artwork = await seedArtwork();
      const { user, token } = await authedUser();

      const a = await mintCollectible({
        owner: user,
        artworkId: artwork.id,
        piecesObtained: 100,
        totalPieces: 100,
      });
      const b = await mintCollectible({
        owner: user,
        artworkId: artwork.id,
        piecesObtained: 100,
        totalPieces: 100,
        listed: true,
      });

      await request(getApp())
        .post('/api/trades/offers')
        .set('Authorization', `Bearer ${token}`)
        .send({ offeredCollectibleId: a, requestedCollectibleId: b })
        .expect(422);
    });
  });

  describe('aceitação atômica', () => {
    async function setupPendingOffer() {
      const artwork = await seedArtwork();
      const proposer = await authedUser();
      const receiver = await authedUser();

      const offered = await mintCollectible({
        owner: proposer.user,
        artworkId: artwork.id,
        piecesObtained: 100,
        totalPieces: 100,
      });
      const requested = await mintCollectible({
        owner: receiver.user,
        artworkId: artwork.id,
        piecesObtained: 95,
        totalPieces: 100,
        listed: true,
      });

      const response = await request(getApp())
        .post('/api/trades/offers')
        .set('Authorization', `Bearer ${proposer.token}`)
        .send({ offeredCollectibleId: offered, requestedCollectibleId: requested })
        .expect(201);

      return { proposer, receiver, offered, requested, offerId: response.body.offer.id as string };
    }

    it('troca os dois donos de uma só vez', async () => {
      const { proposer, receiver, offered, requested, offerId } = await setupPendingOffer();

      await request(getApp())
        .post(`/api/trades/offers/${offerId}/accept`)
        .set('Authorization', `Bearer ${receiver.token}`)
        .expect(200);

      const owners = await pool.query(
        'SELECT id, owner_id, is_listed_for_trade FROM collectibles WHERE id = ANY($1::uuid[])',
        [[offered, requested]],
      );

      const offeredRow = owners.rows.find((row) => row.id === offered);
      const requestedRow = owners.rows.find((row) => row.id === requested);

      expect(offeredRow.owner_id).toBe(receiver.user.id);
      expect(requestedRow.owner_id).toBe(proposer.user.id);
      // Both come off the trade board after the swap.
      expect(offeredRow.is_listed_for_trade).toBe(false);
      expect(requestedRow.is_listed_for_trade).toBe(false);

      const trades = await pool.query('SELECT count(*)::int AS total FROM trades');
      expect(trades.rows[0].total).toBe(1);
    });

    it('aceita apenas uma vez, mesmo com requisições simultâneas', async () => {
      const { receiver, offerId } = await setupPendingOffer();

      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          request(getApp())
            .post(`/api/trades/offers/${offerId}/accept`)
            .set('Authorization', `Bearer ${receiver.token}`),
        ),
      );

      const accepted = results.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 200,
      );
      expect(accepted).toHaveLength(1);

      const trades = await pool.query('SELECT count(*)::int AS total FROM trades');
      expect(trades.rows[0].total).toBe(1);
    });

    it('somente quem recebeu pode aceitar', async () => {
      const { proposer, offerId } = await setupPendingOffer();

      await request(getApp())
        .post(`/api/trades/offers/${offerId}/accept`)
        .set('Authorization', `Bearer ${proposer.token}`)
        .expect(403);
    });

    it('invalida propostas concorrentes sobre os mesmos colecionáveis', async () => {
      const artwork = await seedArtwork();
      const owner = await authedUser();
      const firstBidder = await authedUser();
      const secondBidder = await authedUser();

      const prize = await mintCollectible({
        owner: owner.user,
        artworkId: artwork.id,
        piecesObtained: 100,
        totalPieces: 100,
        listed: true,
      });
      const firstOffered = await mintCollectible({
        owner: firstBidder.user,
        artworkId: artwork.id,
        piecesObtained: 95,
        totalPieces: 100,
      });
      const secondOffered = await mintCollectible({
        owner: secondBidder.user,
        artworkId: artwork.id,
        piecesObtained: 92,
        totalPieces: 100,
      });

      const firstOffer = await request(getApp())
        .post('/api/trades/offers')
        .set('Authorization', `Bearer ${firstBidder.token}`)
        .send({ offeredCollectibleId: firstOffered, requestedCollectibleId: prize })
        .expect(201);

      const secondOffer = await request(getApp())
        .post('/api/trades/offers')
        .set('Authorization', `Bearer ${secondBidder.token}`)
        .send({ offeredCollectibleId: secondOffered, requestedCollectibleId: prize })
        .expect(201);

      await request(getApp())
        .post(`/api/trades/offers/${firstOffer.body.offer.id}/accept`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);

      // The losing proposal must not remain actionable against stale ownership.
      const stale = await pool.query('SELECT status FROM trade_offers WHERE id = $1', [
        secondOffer.body.offer.id,
      ]);
      expect(stale.rows[0].status).toBe('SUPERSEDED');

      await request(getApp())
        .post(`/api/trades/offers/${secondOffer.body.offer.id}/accept`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(409);
    });
  });

  describe('ciclo de vida da proposta', () => {
    it('permite recusar e cancelar, respeitando os papéis', async () => {
      const artwork = await seedArtwork();
      const proposer = await authedUser();
      const receiver = await authedUser();

      const offered = await mintCollectible({
        owner: proposer.user,
        artworkId: artwork.id,
        piecesObtained: 100,
        totalPieces: 100,
      });
      const requested = await mintCollectible({
        owner: receiver.user,
        artworkId: artwork.id,
        piecesObtained: 90,
        totalPieces: 100,
        listed: true,
      });

      const created = await request(getApp())
        .post('/api/trades/offers')
        .set('Authorization', `Bearer ${proposer.token}`)
        .send({ offeredCollectibleId: offered, requestedCollectibleId: requested })
        .expect(201);
      const offerId = created.body.offer.id as string;

      // The proposer cannot reject their own proposal.
      await request(getApp())
        .post(`/api/trades/offers/${offerId}/reject`)
        .set('Authorization', `Bearer ${proposer.token}`)
        .expect(403);

      await request(getApp())
        .post(`/api/trades/offers/${offerId}/cancel`)
        .set('Authorization', `Bearer ${proposer.token}`)
        .expect(200);

      // Nothing more can happen to a resolved proposal.
      await request(getApp())
        .post(`/api/trades/offers/${offerId}/accept`)
        .set('Authorization', `Bearer ${receiver.token}`)
        .expect(409);

      const owners = await pool.query(
        'SELECT owner_id FROM collectibles WHERE id = $1',
        [offered],
      );
      expect(owners.rows[0].owner_id).toBe(proposer.user.id);
    });

    it('impede propostas duplicadas', async () => {
      const artwork = await seedArtwork();
      const proposer = await authedUser();
      const receiver = await authedUser();

      const offered = await mintCollectible({
        owner: proposer.user,
        artworkId: artwork.id,
        piecesObtained: 100,
        totalPieces: 100,
      });
      const requested = await mintCollectible({
        owner: receiver.user,
        artworkId: artwork.id,
        piecesObtained: 90,
        totalPieces: 100,
        listed: true,
      });

      const body = { offeredCollectibleId: offered, requestedCollectibleId: requested };

      await request(getApp())
        .post('/api/trades/offers')
        .set('Authorization', `Bearer ${proposer.token}`)
        .send(body)
        .expect(201);

      const duplicate = await request(getApp())
        .post('/api/trades/offers')
        .set('Authorization', `Bearer ${proposer.token}`)
        .send(body)
        .expect(409);

      expect(duplicate.body.error.code).toBe('DUPLICATE_TRADE_OFFER');
    });

    it('lista apenas cópias elegíveis de outras pessoas no mural', async () => {
      const artwork = await seedArtwork();
      const viewer = await authedUser();
      const other = await authedUser();

      await mintCollectible({
        owner: viewer.user,
        artworkId: artwork.id,
        piecesObtained: 100,
        totalPieces: 100,
        listed: true,
      });
      const theirs = await mintCollectible({
        owner: other.user,
        artworkId: artwork.id,
        piecesObtained: 95,
        totalPieces: 100,
        listed: true,
      });

      const response = await request(getApp())
        .get('/api/trades/available')
        .set('Authorization', `Bearer ${viewer.token}`)
        .expect(200);

      const ids = response.body.collectibles.map((item: { id: string }) => item.id);
      expect(ids).toContain(theirs);
      expect(ids).toHaveLength(1);
    });
  });
});
