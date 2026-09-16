import type { Rarity } from '@kenai/shared';
import { pool } from '../database/pool.js';
import type { Queryable } from '../database/types.js';
import type { ArtworkRecord } from '../types/models.js';
import { mapArtwork } from './mappers.js';

const SELECT_COLUMNS = `
  id, name, description, rarity, storage_bucket, storage_path,
  width, height, mime_type, byte_size, is_active, created_by, created_at, updated_at
`;

export async function findArtworkById(
  id: string,
  db: Queryable = pool,
): Promise<ArtworkRecord | null> {
  const result = await db.query(`SELECT ${SELECT_COLUMNS} FROM artworks WHERE id = $1`, [id]);
  return result.rows[0] ? mapArtwork(result.rows[0]) : null;
}

export async function findArtworkByStoragePath(
  bucket: string,
  path: string,
  db: Queryable = pool,
): Promise<ArtworkRecord | null> {
  const result = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM artworks WHERE storage_bucket = $1 AND storage_path = $2`,
    [bucket, path],
  );
  return result.rows[0] ? mapArtwork(result.rows[0]) : null;
}

/** Active artworks for a rarity — the eligible pool the reward engine draws from. */
export async function findActiveArtworksByRarity(
  rarity: Rarity,
  db: Queryable = pool,
): Promise<ArtworkRecord[]> {
  const result = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM artworks WHERE rarity = $1 AND is_active ORDER BY created_at`,
    [rarity],
  );
  return result.rows.map(mapArtwork);
}

/** How many active artworks exist per rarity — used to drop empty pools before drawing. */
export async function countActiveArtworksByRarity(
  db: Queryable = pool,
): Promise<Record<string, number>> {
  const result = await db.query(
    `SELECT rarity, count(*)::int AS total FROM artworks WHERE is_active GROUP BY rarity`,
  );
  const counts: Record<string, number> = {};
  for (const row of result.rows) counts[row.rarity] = row.total;
  return counts;
}

export async function countArtworks(
  db: Queryable = pool,
): Promise<{ total: number; active: number }> {
  const result = await db.query(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE is_active)::int AS active
     FROM artworks`,
  );
  return { total: result.rows[0]?.total ?? 0, active: result.rows[0]?.active ?? 0 };
}

export interface ArtworkWithUsage extends ArtworkRecord {
  collectiblesAwarded: number;
  activeGoals: number;
}

export async function listArtworks(
  filters: { rarity?: Rarity; isActive?: boolean; search?: string },
  db: Queryable = pool,
): Promise<ArtworkWithUsage[]> {
  const search = filters.search?.trim() ? `%${filters.search.trim()}%` : null;
  const result = await db.query(
    `SELECT a.id, a.name, a.description, a.rarity, a.storage_bucket, a.storage_path,
            a.width, a.height, a.mime_type, a.byte_size, a.is_active, a.created_by,
            a.created_at, a.updated_at,
            count(DISTINCT c.id)::int AS collectibles_awarded,
            count(DISTINCT g.id) FILTER (WHERE g.status = 'ACTIVE')::int AS active_goals
     FROM artworks a
     LEFT JOIN collectibles c ON c.artwork_id = a.id
     LEFT JOIN goals g        ON g.artwork_id = a.id
     WHERE ($1::rarity IS NULL OR a.rarity = $1)
       AND ($2::boolean IS NULL OR a.is_active = $2)
       AND ($3::text IS NULL OR a.name ILIKE $3)
     GROUP BY a.id
     ORDER BY a.created_at DESC`,
    [filters.rarity ?? null, filters.isActive ?? null, search],
  );

  return result.rows.map((row) => ({
    ...mapArtwork(row),
    collectiblesAwarded: row.collectibles_awarded,
    activeGoals: row.active_goals,
  }));
}

export async function createArtwork(
  params: {
    name: string;
    description?: string | null;
    rarity: Rarity;
    storageBucket: string;
    storagePath: string;
    width: number;
    height: number;
    mimeType: string;
    byteSize: number;
    isActive: boolean;
    createdBy: string | null;
  },
  db: Queryable = pool,
): Promise<ArtworkRecord> {
  const result = await db.query(
    `INSERT INTO artworks
       (name, description, rarity, storage_bucket, storage_path,
        width, height, mime_type, byte_size, is_active, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${SELECT_COLUMNS}`,
    [
      params.name,
      params.description ?? null,
      params.rarity,
      params.storageBucket,
      params.storagePath,
      params.width,
      params.height,
      params.mimeType,
      params.byteSize,
      params.isActive,
      params.createdBy,
    ],
  );
  return mapArtwork(result.rows[0]);
}

export async function updateArtwork(
  id: string,
  params: {
    name?: string;
    description?: string | null;
    rarity?: Rarity;
    isActive?: boolean;
  },
  db: Queryable = pool,
): Promise<ArtworkRecord | null> {
  const result = await db.query(
    `UPDATE artworks SET
       name        = COALESCE($2, name),
       description = CASE WHEN $3::boolean THEN $4 ELSE description END,
       rarity      = COALESCE($5::rarity, rarity),
       is_active   = COALESCE($6::boolean, is_active)
     WHERE id = $1
     RETURNING ${SELECT_COLUMNS}`,
    [
      id,
      params.name ?? null,
      params.description !== undefined,
      params.description ?? null,
      params.rarity ?? null,
      params.isActive ?? null,
    ],
  );
  return result.rows[0] ? mapArtwork(result.rows[0]) : null;
}

/**
 * Hard deletion is only ever allowed for an artwork nothing references.
 * Anything already awarded or assigned must be deactivated instead, so existing
 * collectibles keep rendering (spec section 43).
 */
export async function countArtworkReferences(
  id: string,
  db: Queryable = pool,
): Promise<{ goals: number; collectibles: number }> {
  const result = await db.query(
    `SELECT
       (SELECT count(*)::int FROM goals WHERE artwork_id = $1)        AS goals,
       (SELECT count(*)::int FROM collectibles WHERE artwork_id = $1) AS collectibles`,
    [id],
  );
  return { goals: result.rows[0]?.goals ?? 0, collectibles: result.rows[0]?.collectibles ?? 0 };
}

export async function deleteArtwork(id: string, db: Queryable = pool): Promise<boolean> {
  const result = await db.query('DELETE FROM artworks WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
