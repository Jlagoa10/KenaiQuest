import type { Rarity } from '@kenai/shared';
import { TRADE_ELIGIBILITY_PERCENT } from '@kenai/shared';
import { pool } from '../database/pool.js';
import type { Queryable } from '../database/types.js';
import type { CollectibleRecord, CollectibleWithRelations } from '../types/models.js';
import { mapCollectible, mapCollectibleWithRelations } from './mappers.js';

const BASE_COLUMNS = `
  c.id, c.owner_id, c.earned_by_user_id, c.artwork_id, c.source_goal_id,
  c.source_competition_id, c.goal_title,
  c.total_pieces, c.pieces_obtained, c.owned_piece_indexes, c.completion_percent,
  c.is_perfect, c.is_listed_for_trade, c.obtained_at
`;

const RELATION_COLUMNS = `
  a.name        AS artwork_name,
  a.description AS artwork_description,
  a.rarity      AS artwork_rarity,
  a.width       AS artwork_width,
  a.height      AS artwork_height,
  owner.name    AS owner_name,
  earner.name   AS earned_by_name,
  (SELECT count(*)::int FROM trade_offers t
    WHERE t.status = 'PENDING'
      AND (t.offered_collectible_id = c.id OR t.requested_collectible_id = c.id)
  ) AS pending_trade_count
`;

const RELATION_JOINS = `
  JOIN artworks a     ON a.id = c.artwork_id
  JOIN users owner    ON owner.id = c.owner_id
  LEFT JOIN users earner ON earner.id = c.earned_by_user_id
`;

/**
 * Trade eligibility expressed as exact integer arithmetic, identical to
 * isTradeEligible() in @kenai/shared. Comparing against the rounded
 * completion_percent column could promote a copy sitting just below the
 * threshold, so the rounded value is display-only.
 */
const ELIGIBLE_PREDICATE = `c.pieces_obtained * 100 >= ${TRADE_ELIGIBILITY_PERCENT} * c.total_pieces`;

export async function createCollectible(
  params: {
    ownerId: string;
    earnedByUserId: string;
    artworkId: string;
    /** Exactly one source: the goal that revealed it, or the competition that awarded it. */
    sourceGoalId: string | null;
    sourceCompetitionId?: string | null;
    goalTitle: string;
    totalPieces: number;
    piecesObtained: number;
    ownedPieceIndexes: number[];
  },
  db: Queryable,
): Promise<CollectibleRecord> {
  const result = await db.query(
    `INSERT INTO collectibles
       (owner_id, earned_by_user_id, artwork_id, source_goal_id, source_competition_id,
        goal_title, total_pieces, pieces_obtained, owned_piece_indexes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::int[])
     RETURNING ${BASE_COLUMNS.replace(/c\./g, '')}`,
    [
      params.ownerId,
      params.earnedByUserId,
      params.artworkId,
      params.sourceGoalId,
      params.sourceCompetitionId ?? null,
      params.goalTitle,
      params.totalPieces,
      params.piecesObtained,
      params.ownedPieceIndexes,
    ],
  );
  return mapCollectible(result.rows[0]);
}

export async function findCollectibleByGoalId(
  goalId: string,
  db: Queryable = pool,
): Promise<CollectibleRecord | null> {
  const result = await db.query(
    `SELECT ${BASE_COLUMNS} FROM collectibles c WHERE c.source_goal_id = $1`,
    [goalId],
  );
  return result.rows[0] ? mapCollectible(result.rows[0]) : null;
}

export async function findCollectibleById(
  id: string,
  db: Queryable = pool,
): Promise<CollectibleWithRelations | null> {
  const result = await db.query(
    `SELECT ${BASE_COLUMNS}, ${RELATION_COLUMNS} FROM collectibles c ${RELATION_JOINS}
     WHERE c.id = $1`,
    [id],
  );
  return result.rows[0] ? mapCollectibleWithRelations(result.rows[0]) : null;
}

/** Locks a set of collectibles in a deterministic order to avoid deadlocks. */
export async function lockCollectiblesForUpdate(
  ids: string[],
  db: Queryable,
): Promise<CollectibleRecord[]> {
  const result = await db.query(
    `SELECT ${BASE_COLUMNS.replace(/c\./g, '')} FROM collectibles
     WHERE id = ANY($1::uuid[])
     ORDER BY id
     FOR UPDATE`,
    [ids],
  );
  return result.rows.map(mapCollectible);
}

export interface CollectibleFilters {
  rarity?: Rarity;
  perfectOnly?: boolean;
  tradableOnly?: boolean;
  listedOnly?: boolean;
  minCompletion?: number;
  search?: string;
}

export async function listCollectiblesByOwner(
  ownerId: string,
  filters: CollectibleFilters,
  db: Queryable = pool,
): Promise<CollectibleWithRelations[]> {
  const search = filters.search?.trim() ? `%${filters.search.trim()}%` : null;
  const result = await db.query(
    `SELECT ${BASE_COLUMNS}, ${RELATION_COLUMNS} FROM collectibles c ${RELATION_JOINS}
     WHERE c.owner_id = $1
       AND ($2::rarity IS NULL OR a.rarity = $2)
       AND ($3::boolean IS NOT TRUE OR c.is_perfect)
       AND ($4::boolean IS NOT TRUE OR ${ELIGIBLE_PREDICATE})
       AND ($5::boolean IS NOT TRUE OR c.is_listed_for_trade)
       AND ($6::numeric IS NULL OR c.completion_percent >= $6)
       AND ($7::text IS NULL OR a.name ILIKE $7 OR c.goal_title ILIKE $7)
     ORDER BY c.obtained_at DESC`,
    [
      ownerId,
      filters.rarity ?? null,
      filters.perfectOnly ?? null,
      filters.tradableOnly ?? null,
      filters.listedOnly ?? null,
      filters.minCompletion ?? null,
      search,
    ],
  );
  return result.rows.map(mapCollectibleWithRelations);
}

/** The public trade board: other people's listed, eligible copies. */
export async function listAvailableForTrade(
  viewerId: string,
  filters: CollectibleFilters,
  db: Queryable = pool,
): Promise<CollectibleWithRelations[]> {
  const search = filters.search?.trim() ? `%${filters.search.trim()}%` : null;
  const result = await db.query(
    `SELECT ${BASE_COLUMNS}, ${RELATION_COLUMNS} FROM collectibles c ${RELATION_JOINS}
     WHERE c.owner_id <> $1
       AND c.is_listed_for_trade
       AND ${ELIGIBLE_PREDICATE}
       AND ($2::rarity IS NULL OR a.rarity = $2)
       AND ($3::numeric IS NULL OR c.completion_percent >= $3)
       AND ($4::text IS NULL OR a.name ILIKE $4)
     ORDER BY c.obtained_at DESC
     LIMIT 120`,
    [viewerId, filters.rarity ?? null, filters.minCompletion ?? null, search],
  );
  return result.rows.map(mapCollectibleWithRelations);
}

export async function setCollectibleListing(
  params: { id: string; ownerId: string; listed: boolean },
  db: Queryable = pool,
): Promise<CollectibleRecord | null> {
  // The eligibility predicate is repeated here so a copy can never be listed
  // below the threshold even if the service layer were bypassed.
  const result = await db.query(
    `UPDATE collectibles c SET is_listed_for_trade = $3
     WHERE c.id = $1 AND c.owner_id = $2
       AND ($3 = false OR ${ELIGIBLE_PREDICATE})
     RETURNING ${BASE_COLUMNS.replace(/c\./g, '')}`,
    [params.id, params.ownerId, params.listed],
  );
  return result.rows[0] ? mapCollectible(result.rows[0]) : null;
}

export async function transferCollectible(
  params: { id: string; newOwnerId: string },
  db: Queryable,
): Promise<void> {
  await db.query(
    `UPDATE collectibles SET owner_id = $2, is_listed_for_trade = false WHERE id = $1`,
    [params.id, params.newOwnerId],
  );
}

export async function countCollectibles(db: Queryable = pool): Promise<number> {
  const result = await db.query('SELECT count(*)::int AS total FROM collectibles');
  return result.rows[0]?.total ?? 0;
}
