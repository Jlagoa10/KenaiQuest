import { pool } from '../database/pool.js';
import type { Queryable } from '../database/types.js';
import type { TradeOfferRecord } from '../types/models.js';
import { mapTradeOffer } from './mappers.js';

const SELECT_COLUMNS = `
  id, offerer_id, receiver_id, offered_collectible_id, requested_collectible_id,
  status, message, created_at, resolved_at
`;

export interface TradeOfferDetailRow extends TradeOfferRecord {
  offererName: string;
  receiverName: string;
  offered: TradeCollectibleSummary;
  requested: TradeCollectibleSummary;
}

export interface TradeCollectibleSummary {
  id: string;
  artworkName: string;
  rarity: string;
  completionPercent: number;
  isPerfect: boolean;
  totalPieces: number;
  piecesObtained: number;
  ownerName: string;
  artworkWidth: number;
  artworkHeight: number;
}

const DETAIL_QUERY = `
  SELECT o.id, o.offerer_id, o.receiver_id, o.offered_collectible_id,
         o.requested_collectible_id, o.status, o.message, o.created_at, o.resolved_at,
         offerer.name  AS offerer_name,
         receiver.name AS receiver_name,
         oc.id AS oc_id, oa.name AS oc_artwork_name, oa.rarity AS oc_rarity,
         oc.completion_percent AS oc_percent, oc.is_perfect AS oc_perfect,
         oc.total_pieces AS oc_total, oc.pieces_obtained AS oc_obtained,
         oco.name AS oc_owner_name, oa.width AS oc_width, oa.height AS oc_height,
         rc.id AS rc_id, ra.name AS rc_artwork_name, ra.rarity AS rc_rarity,
         rc.completion_percent AS rc_percent, rc.is_perfect AS rc_perfect,
         rc.total_pieces AS rc_total, rc.pieces_obtained AS rc_obtained,
         rco.name AS rc_owner_name, ra.width AS rc_width, ra.height AS rc_height
  FROM trade_offers o
  JOIN users offerer  ON offerer.id = o.offerer_id
  JOIN users receiver ON receiver.id = o.receiver_id
  JOIN collectibles oc ON oc.id = o.offered_collectible_id
  JOIN artworks oa     ON oa.id = oc.artwork_id
  JOIN users oco       ON oco.id = oc.owner_id
  JOIN collectibles rc ON rc.id = o.requested_collectible_id
  JOIN artworks ra     ON ra.id = rc.artwork_id
  JOIN users rco       ON rco.id = rc.owner_id
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapDetail(row: Record<string, any>): TradeOfferDetailRow {
  return {
    ...mapTradeOffer(row),
    offererName: row.offerer_name,
    receiverName: row.receiver_name,
    offered: {
      id: row.oc_id,
      artworkName: row.oc_artwork_name,
      rarity: row.oc_rarity,
      completionPercent: Number(row.oc_percent),
      isPerfect: row.oc_perfect,
      totalPieces: row.oc_total,
      piecesObtained: row.oc_obtained,
      ownerName: row.oc_owner_name,
      artworkWidth: row.oc_width,
      artworkHeight: row.oc_height,
    },
    requested: {
      id: row.rc_id,
      artworkName: row.rc_artwork_name,
      rarity: row.rc_rarity,
      completionPercent: Number(row.rc_percent),
      isPerfect: row.rc_perfect,
      totalPieces: row.rc_total,
      piecesObtained: row.rc_obtained,
      ownerName: row.rc_owner_name,
      artworkWidth: row.rc_width,
      artworkHeight: row.rc_height,
    },
  };
}

export async function createTradeOffer(
  params: {
    offererId: string;
    receiverId: string;
    offeredCollectibleId: string;
    requestedCollectibleId: string;
    message: string | null;
  },
  db: Queryable = pool,
): Promise<TradeOfferRecord> {
  const result = await db.query(
    `INSERT INTO trade_offers
       (offerer_id, receiver_id, offered_collectible_id, requested_collectible_id, message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SELECT_COLUMNS}`,
    [
      params.offererId,
      params.receiverId,
      params.offeredCollectibleId,
      params.requestedCollectibleId,
      params.message,
    ],
  );
  return mapTradeOffer(result.rows[0]);
}

export async function findTradeOfferById(
  id: string,
  db: Queryable = pool,
): Promise<TradeOfferRecord | null> {
  const result = await db.query(`SELECT ${SELECT_COLUMNS} FROM trade_offers WHERE id = $1`, [id]);
  return result.rows[0] ? mapTradeOffer(result.rows[0]) : null;
}

export async function findTradeOfferByIdForUpdate(
  id: string,
  db: Queryable,
): Promise<TradeOfferRecord | null> {
  const result = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM trade_offers WHERE id = $1 FOR UPDATE`,
    [id],
  );
  return result.rows[0] ? mapTradeOffer(result.rows[0]) : null;
}

export async function listTradeOffers(
  params: { userId: string; direction: 'sent' | 'received' | 'history' },
  db: Queryable = pool,
): Promise<TradeOfferDetailRow[]> {
  const condition =
    params.direction === 'sent'
      ? `o.offerer_id = $1 AND o.status = 'PENDING'`
      : params.direction === 'received'
        ? `o.receiver_id = $1 AND o.status = 'PENDING'`
        : `(o.offerer_id = $1 OR o.receiver_id = $1) AND o.status <> 'PENDING'`;

  const result = await db.query(
    `${DETAIL_QUERY} WHERE ${condition} ORDER BY o.created_at DESC LIMIT 100`,
    [params.userId],
  );
  return result.rows.map(mapDetail);
}

export async function findTradeOfferDetail(
  id: string,
  db: Queryable = pool,
): Promise<TradeOfferDetailRow | null> {
  const result = await db.query(`${DETAIL_QUERY} WHERE o.id = $1`, [id]);
  return result.rows[0] ? mapDetail(result.rows[0]) : null;
}

export async function resolveTradeOffer(
  params: { id: string; status: 'ACCEPTED' | 'REJECTED' | 'CANCELLED' },
  db: Queryable,
): Promise<boolean> {
  const result = await db.query(
    `UPDATE trade_offers SET status = $2::trade_offer_status, resolved_at = now()
     WHERE id = $1 AND status = 'PENDING'`,
    [params.id, params.status],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * After a swap, every other open proposal touching either collectible is stale:
 * the owner changed, so it can never be honoured. Closing them here — inside the
 * same transaction — is what prevents a second acceptance from succeeding
 * against outdated ownership.
 */
export async function supersedeOffersForCollectibles(
  params: { collectibleIds: string[]; exceptOfferId: string },
  db: Queryable,
): Promise<number> {
  const result = await db.query(
    `UPDATE trade_offers SET status = 'SUPERSEDED', resolved_at = now()
     WHERE status = 'PENDING'
       AND id <> $2
       AND (offered_collectible_id = ANY($1::uuid[])
            OR requested_collectible_id = ANY($1::uuid[]))`,
    [params.collectibleIds, params.exceptOfferId],
  );
  return result.rowCount ?? 0;
}

export async function recordTrade(
  params: {
    offerId: string;
    userAId: string;
    userBId: string;
    collectibleAId: string;
    collectibleBId: string;
  },
  db: Queryable,
): Promise<void> {
  await db.query(
    `INSERT INTO trades (offer_id, user_a_id, user_b_id, collectible_a_id, collectible_b_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      params.offerId,
      params.userAId,
      params.userBId,
      params.collectibleAId,
      params.collectibleBId,
    ],
  );
}

export async function countTrades(
  db: Queryable = pool,
): Promise<{ pending: number; completed: number }> {
  const result = await db.query(
    `SELECT
       (SELECT count(*)::int FROM trade_offers WHERE status = 'PENDING') AS pending,
       (SELECT count(*)::int FROM trades)                                AS completed`,
  );
  return { pending: result.rows[0]?.pending ?? 0, completed: result.rows[0]?.completed ?? 0 };
}
