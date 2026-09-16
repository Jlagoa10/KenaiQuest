import type { ThemePreference, UserRole } from '@kenai/shared';
import { pool } from '../database/pool.js';
import type { Queryable } from '../database/types.js';
import type { UserRecord } from '../types/models.js';
import { mapUser } from './mappers.js';

const SELECT_COLUMNS = `
  id, name, email, password_hash, role, timezone, theme_preference, created_at, updated_at
`;

export async function findUserById(id: string, db: Queryable = pool): Promise<UserRecord | null> {
  const result = await db.query(`SELECT ${SELECT_COLUMNS} FROM users WHERE id = $1`, [id]);
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findUserByEmail(
  email: string,
  db: Queryable = pool,
): Promise<UserRecord | null> {
  const result = await db.query(`SELECT ${SELECT_COLUMNS} FROM users WHERE email = $1`, [email]);
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function createUser(
  params: {
    name: string;
    email: string;
    passwordHash: string;
    timezone: string;
    role?: UserRole;
  },
  db: Queryable = pool,
): Promise<UserRecord> {
  const result = await db.query(
    `INSERT INTO users (name, email, password_hash, timezone, role)
     VALUES ($1, $2, $3, $4, COALESCE($5::user_role, 'USER'))
     RETURNING ${SELECT_COLUMNS}`,
    [params.name, params.email, params.passwordHash, params.timezone, params.role ?? null],
  );
  return mapUser(result.rows[0]);
}

export async function updateUserProfile(
  id: string,
  params: { name?: string; timezone?: string; themePreference?: ThemePreference },
  db: Queryable = pool,
): Promise<UserRecord | null> {
  const result = await db.query(
    `UPDATE users SET
       name             = COALESCE($2, name),
       timezone         = COALESCE($3, timezone),
       theme_preference = COALESCE($4::theme_preference, theme_preference)
     WHERE id = $1
     RETURNING ${SELECT_COLUMNS}`,
    [id, params.name ?? null, params.timezone ?? null, params.themePreference ?? null],
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function updateUserPassword(
  id: string,
  passwordHash: string,
  db: Queryable = pool,
): Promise<void> {
  await db.query('UPDATE users SET password_hash = $2 WHERE id = $1', [id, passwordHash]);
}

export async function updateUserRole(
  id: string,
  role: UserRole,
  db: Queryable = pool,
): Promise<UserRecord | null> {
  const result = await db.query(
    `UPDATE users SET role = $2 WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
    [id, role],
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function countAdmins(db: Queryable = pool): Promise<number> {
  const result = await db.query(`SELECT count(*)::int AS total FROM users WHERE role = 'ADMIN'`);
  return result.rows[0]?.total ?? 0;
}

export async function countUsersByRole(
  db: Queryable = pool,
): Promise<{ total: number; admins: number }> {
  const result = await db.query(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE role = 'ADMIN')::int AS admins
     FROM users`,
  );
  return { total: result.rows[0]?.total ?? 0, admins: result.rows[0]?.admins ?? 0 };
}

/** Per-user activity counters shown next to a role change. */
export async function countUserActivity(
  userId: string,
  db: Queryable = pool,
): Promise<{ goals: number; collectibles: number }> {
  const result = await db.query(
    `SELECT
       (SELECT count(*)::int FROM goals WHERE user_id = $1)         AS goals,
       (SELECT count(*)::int FROM collectibles WHERE owner_id = $1) AS collectibles`,
    [userId],
  );
  return {
    goals: result.rows[0]?.goals ?? 0,
    collectibles: result.rows[0]?.collectibles ?? 0,
  };
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  timezone: string;
  goalsCount: number;
  collectiblesCount: number;
  createdAt: Date;
}

export async function listUsersForAdmin(
  params: { search?: string; page: number; pageSize: number },
  db: Queryable = pool,
): Promise<{ items: AdminUserRow[]; total: number }> {
  const offset = (params.page - 1) * params.pageSize;
  const search = params.search?.trim() ? `%${params.search.trim()}%` : null;

  const result = await db.query(
    `SELECT
       u.id, u.name, u.email, u.role, u.timezone, u.created_at,
       count(DISTINCT g.id)::int AS goals_count,
       count(DISTINCT c.id)::int AS collectibles_count,
       count(*) OVER ()::int      AS total_count
     FROM users u
     LEFT JOIN goals g        ON g.user_id = u.id
     LEFT JOIN collectibles c ON c.owner_id = u.id
     WHERE ($1::text IS NULL OR u.name ILIKE $1 OR u.email ILIKE $1)
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT $2 OFFSET $3`,
    [search, params.pageSize, offset],
  );

  return {
    total: result.rows[0]?.total_count ?? 0,
    items: result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      timezone: row.timezone,
      goalsCount: row.goals_count,
      collectiblesCount: row.collectibles_count,
      createdAt: row.created_at,
    })),
  };
}
