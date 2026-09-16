import { pool } from '../database/pool.js';
import type { Queryable } from '../database/types.js';

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export async function storeRefreshToken(
  params: { userId: string; tokenHash: string; familyId: string; expiresAt: Date },
  db: Queryable = pool,
): Promise<void> {
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [params.userId, params.tokenHash, params.familyId, params.expiresAt],
  );
}

export async function findRefreshTokenByHash(
  tokenHash: string,
  db: Queryable = pool,
): Promise<RefreshTokenRecord | null> {
  const result = await db.query(
    `SELECT id, user_id, family_id, expires_at, revoked_at
     FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    familyId: row.family_id,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

export async function revokeRefreshToken(id: string, db: Queryable = pool): Promise<void> {
  await db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [
    id,
  ]);
}

/**
 * Reuse detection: presenting an already-rotated token means it leaked, so the
 * entire rotation chain is burned and the user must sign in again.
 */
export async function revokeRefreshTokenFamily(
  familyId: string,
  db: Queryable = pool,
): Promise<void> {
  await db.query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL',
    [familyId],
  );
}

export async function revokeAllUserRefreshTokens(
  userId: string,
  db: Queryable = pool,
): Promise<void> {
  await db.query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId],
  );
}

export async function deleteExpiredRefreshTokens(db: Queryable = pool): Promise<number> {
  const result = await db.query('DELETE FROM refresh_tokens WHERE expires_at < now()');
  return result.rowCount ?? 0;
}
