import type { IsoDate } from '@kenai/shared';
import { pool } from '../database/pool.js';
import type { Queryable } from '../database/types.js';
import type { GoalDayRecord } from '../types/models.js';
import { mapGoalDay } from './mappers.js';

const SELECT_COLUMNS = `id, goal_id, day_number, day_date, piece_index, status, completed_at`;

/**
 * Bulk insert of the whole goal timeline in one statement.
 * `pieceIndexes` is the pre-shuffled reveal order: position i holds the piece
 * that day i+1 unlocks. It is generated once, here, and never regenerated.
 */
export async function createGoalDays(
  params: { goalId: string; dates: IsoDate[]; pieceIndexes: number[] },
  db: Queryable,
): Promise<void> {
  if (params.dates.length !== params.pieceIndexes.length) {
    throw new Error('A quantidade de dias e de peças precisa ser idêntica.');
  }

  await db.query(
    `INSERT INTO goal_days (goal_id, day_number, day_date, piece_index)
     SELECT $1, ordinality::int, day_date::date, piece_index
     FROM unnest($2::date[], $3::int[]) WITH ORDINALITY AS t(day_date, piece_index, ordinality)`,
    [params.goalId, params.dates, params.pieceIndexes],
  );
}

export async function listGoalDays(
  goalId: string,
  db: Queryable = pool,
): Promise<GoalDayRecord[]> {
  const result = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM goal_days WHERE goal_id = $1 ORDER BY day_number`,
    [goalId],
  );
  return result.rows.map(mapGoalDay);
}

/**
 * Permanently closes every pending day whose grace window has expired.
 *
 * Idempotent and set-based: running it twice changes nothing, and a day can
 * only ever move PENDING -> MISSED here, never back. `cutoffDate` is the
 * earliest date still claimable, computed from the OWNER's timezone.
 */
export async function resolveExpiredDays(
  params: { goalId: string; cutoffDate: IsoDate },
  db: Queryable,
): Promise<number> {
  const result = await db.query(
    `UPDATE goal_days SET status = 'MISSED'
     WHERE goal_id = $1 AND status = 'PENDING' AND day_date < $2::date`,
    [params.goalId, params.cutoffDate],
  );
  return result.rowCount ?? 0;
}

/**
 * Claims a single day. The WHERE clause carries the whole rule set, so the
 * database itself rejects a replayed or forged request: the row must belong to
 * the goal, still be PENDING, and fall inside the Hoje/Ontem window.
 * Returns null when nothing matched, which the service turns into a precise
 * error after inspecting the row.
 */
export async function completeGoalDay(
  params: { goalId: string; date: IsoDate; cutoffDate: IsoDate; todayDate: IsoDate },
  db: Queryable,
): Promise<GoalDayRecord | null> {
  const result = await db.query(
    `UPDATE goal_days SET status = 'COMPLETED', completed_at = now()
     WHERE goal_id = $1
       AND day_date = $2::date
       AND status = 'PENDING'
       AND day_date >= $3::date
       AND day_date <= $4::date
     RETURNING ${SELECT_COLUMNS}`,
    [params.goalId, params.date, params.cutoffDate, params.todayDate],
  );
  return result.rows[0] ? mapGoalDay(result.rows[0]) : null;
}

export async function findGoalDayByDate(
  goalId: string,
  date: IsoDate,
  db: Queryable = pool,
): Promise<GoalDayRecord | null> {
  const result = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM goal_days WHERE goal_id = $1 AND day_date = $2::date`,
    [goalId, date],
  );
  return result.rows[0] ? mapGoalDay(result.rows[0]) : null;
}

/** Piece indexes unlocked so far. Feeds the server-side image compositor. */
export async function listCompletedPieceIndexes(
  goalId: string,
  db: Queryable = pool,
): Promise<number[]> {
  const result = await db.query(
    `SELECT piece_index FROM goal_days
     WHERE goal_id = $1 AND status = 'COMPLETED'
     ORDER BY piece_index`,
    [goalId],
  );
  return result.rows.map((row) => row.piece_index as number);
}
