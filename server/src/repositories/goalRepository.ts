import type { GoalStatus, IsoDate } from '@kenai/shared';
import { pool } from '../database/pool.js';
import type { Queryable } from '../database/types.js';
import type { GoalDayCounts, GoalRecord } from '../types/models.js';
import { mapGoal } from './mappers.js';

const SELECT_COLUMNS = `
  id, user_id, title, description, status, duration_days, start_date, end_date,
  artwork_id, total_pieces, finalized_at, cancelled_at, created_at, updated_at
`;

export async function countActiveGoals(
  userId: string,
  db: Queryable = pool,
): Promise<number> {
  const result = await db.query(
    `SELECT count(*)::int AS total FROM goals WHERE user_id = $1 AND status = 'ACTIVE'`,
    [userId],
  );
  return result.rows[0]?.total ?? 0;
}

export async function createGoal(
  params: {
    userId: string;
    title: string;
    description: string | null;
    durationDays: number;
    startDate: IsoDate;
    endDate: IsoDate;
    artworkId: string;
  },
  db: Queryable = pool,
): Promise<GoalRecord> {
  const result = await db.query(
    `INSERT INTO goals
       (user_id, title, description, duration_days, start_date, end_date, artwork_id, total_pieces)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $4)
     RETURNING ${SELECT_COLUMNS}`,
    [
      params.userId,
      params.title,
      params.description,
      params.durationDays,
      params.startDate,
      params.endDate,
      params.artworkId,
    ],
  );
  return mapGoal(result.rows[0]);
}

export async function findGoalById(id: string, db: Queryable = pool): Promise<GoalRecord | null> {
  const result = await db.query(`SELECT ${SELECT_COLUMNS} FROM goals WHERE id = $1`, [id]);
  return result.rows[0] ? mapGoal(result.rows[0]) : null;
}

/**
 * Row-locking read used by every mutation path. Serialises concurrent requests
 * against the same goal, so day resolution and finalisation cannot interleave.
 */
export async function findGoalByIdForUpdate(
  id: string,
  db: Queryable,
): Promise<GoalRecord | null> {
  const result = await db.query(`SELECT ${SELECT_COLUMNS} FROM goals WHERE id = $1 FOR UPDATE`, [
    id,
  ]);
  return result.rows[0] ? mapGoal(result.rows[0]) : null;
}

export async function listGoalsByUser(
  userId: string,
  status: GoalStatus | undefined,
  db: Queryable = pool,
): Promise<GoalRecord[]> {
  const result = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM goals
     WHERE user_id = $1 AND ($2::goal_status IS NULL OR status = $2)
     ORDER BY
       CASE status WHEN 'ACTIVE' THEN 0 WHEN 'COMPLETED' THEN 1 ELSE 2 END,
       created_at DESC`,
    [userId, status ?? null],
  );
  return result.rows.map(mapGoal);
}

/** Active goals whose days may need resolving. Drives the background sweep. */
export async function listActiveGoalIds(db: Queryable = pool): Promise<string[]> {
  const result = await db.query(`SELECT id FROM goals WHERE status = 'ACTIVE' ORDER BY created_at`);
  return result.rows.map((row) => row.id as string);
}

export async function markGoalCompleted(id: string, db: Queryable): Promise<GoalRecord | null> {
  const result = await db.query(
    `UPDATE goals SET status = 'COMPLETED', finalized_at = now()
     WHERE id = $1 AND status = 'ACTIVE'
     RETURNING ${SELECT_COLUMNS}`,
    [id],
  );
  return result.rows[0] ? mapGoal(result.rows[0]) : null;
}

export async function markGoalCancelled(id: string, db: Queryable): Promise<boolean> {
  const result = await db.query(
    `UPDATE goals SET status = 'CANCELLED', cancelled_at = now()
     WHERE id = $1 AND status = 'ACTIVE'`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function countGoalDayStatuses(
  goalId: string,
  db: Queryable = pool,
): Promise<GoalDayCounts> {
  const result = await db.query(
    `SELECT
       count(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
       count(*) FILTER (WHERE status = 'MISSED')::int    AS missed,
       count(*) FILTER (WHERE status = 'PENDING')::int   AS pending
     FROM goal_days WHERE goal_id = $1`,
    [goalId],
  );
  const row = result.rows[0];
  return {
    completed: row?.completed ?? 0,
    missed: row?.missed ?? 0,
    pending: row?.pending ?? 0,
  };
}

/** Day counts for many goals at once — avoids N+1 on the dashboard. */
export async function countGoalDayStatusesForGoals(
  goalIds: string[],
  db: Queryable = pool,
): Promise<Map<string, GoalDayCounts>> {
  const counts = new Map<string, GoalDayCounts>();
  if (goalIds.length === 0) return counts;

  const result = await db.query(
    `SELECT goal_id,
       count(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
       count(*) FILTER (WHERE status = 'MISSED')::int    AS missed,
       count(*) FILTER (WHERE status = 'PENDING')::int   AS pending
     FROM goal_days WHERE goal_id = ANY($1::uuid[])
     GROUP BY goal_id`,
    [goalIds],
  );

  for (const row of result.rows) {
    counts.set(row.goal_id, {
      completed: row.completed,
      missed: row.missed,
      pending: row.pending,
    });
  }
  return counts;
}

export async function countGoalsByStatus(
  db: Queryable = pool,
): Promise<Record<GoalStatus, number>> {
  const result = await db.query(
    `SELECT status, count(*)::int AS total FROM goals GROUP BY status`,
  );
  const counts: Record<GoalStatus, number> = { ACTIVE: 0, COMPLETED: 0, CANCELLED: 0 };
  for (const row of result.rows) counts[row.status as GoalStatus] = row.total;
  return counts;
}
