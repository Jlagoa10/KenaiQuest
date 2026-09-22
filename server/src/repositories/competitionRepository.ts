import type { IsoDate, Rarity } from '@kenai/shared';
import { pool } from '../database/pool.js';
import type { Queryable } from '../database/types.js';
import type {
  CompetitionParticipantRecord,
  CompetitionRecord,
  CompetitionResultRecord,
  CompetitionScoringDayRecord,
} from '../types/models.js';
import { mapCompetition, mapCompetitionParticipant, mapCompetitionResult } from './mappers.js';

const SELECT_COLUMNS = `
  id, name, creator_id, start_date, end_date, timezone, invite_code,
  finalized_at, created_at, updated_at
`;

export async function createCompetition(
  params: {
    name: string;
    creatorId: string;
    startDate: IsoDate;
    endDate: IsoDate;
    timezone: string;
    inviteCode: string;
  },
  db: Queryable,
): Promise<CompetitionRecord> {
  const result = await db.query(
    `INSERT INTO competitions (name, creator_id, start_date, end_date, timezone, invite_code)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${SELECT_COLUMNS}`,
    [params.name, params.creatorId, params.startDate, params.endDate, params.timezone, params.inviteCode],
  );
  return mapCompetition(result.rows[0]);
}

export async function inviteCodeExists(code: string, db: Queryable = pool): Promise<boolean> {
  const result = await db.query('SELECT 1 FROM competitions WHERE invite_code = $1', [code]);
  return (result.rowCount ?? 0) > 0;
}

export async function findCompetitionById(
  id: string,
  db: Queryable = pool,
): Promise<CompetitionRecord | null> {
  const result = await db.query(`SELECT ${SELECT_COLUMNS} FROM competitions WHERE id = $1`, [id]);
  return result.rows[0] ? mapCompetition(result.rows[0]) : null;
}

/**
 * Row lock taken by every path that changes a competition — joining and
 * locking the result — so those can never interleave.
 */
export async function findCompetitionByIdForUpdate(
  id: string,
  db: Queryable,
): Promise<CompetitionRecord | null> {
  const result = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM competitions WHERE id = $1 FOR UPDATE`,
    [id],
  );
  return result.rows[0] ? mapCompetition(result.rows[0]) : null;
}

export async function findCompetitionByInviteCode(
  code: string,
  db: Queryable = pool,
): Promise<CompetitionRecord | null> {
  const result = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM competitions WHERE invite_code = $1`,
    [code],
  );
  return result.rows[0] ? mapCompetition(result.rows[0]) : null;
}

/** Competitions the user takes part in, newest start first. */
export async function listCompetitionsForUser(
  userId: string,
  db: Queryable = pool,
): Promise<CompetitionRecord[]> {
  const result = await db.query(
    `SELECT c.id, c.name, c.creator_id, c.start_date, c.end_date, c.timezone, c.invite_code,
            c.finalized_at, c.created_at, c.updated_at
     FROM competitions c
     JOIN competition_participants p ON p.competition_id = c.id
     WHERE p.user_id = $1
     ORDER BY c.finalized_at IS NOT NULL, c.start_date DESC, c.created_at DESC`,
    [userId],
  );
  return result.rows.map(mapCompetition);
}

export async function listParticipants(
  competitionId: string,
  db: Queryable = pool,
): Promise<CompetitionParticipantRecord[]> {
  const result = await db.query(
    `SELECT p.competition_id, p.user_id, p.joined_at,
            u.name AS user_name, u.timezone AS user_timezone
     FROM competition_participants p
     JOIN users u ON u.id = p.user_id
     WHERE p.competition_id = $1
     ORDER BY p.joined_at, p.user_id`,
    [competitionId],
  );
  return result.rows.map(mapCompetitionParticipant);
}

export async function listParticipantsForCompetitions(
  competitionIds: string[],
  db: Queryable = pool,
): Promise<Map<string, CompetitionParticipantRecord[]>> {
  const byCompetition = new Map<string, CompetitionParticipantRecord[]>();
  if (competitionIds.length === 0) return byCompetition;

  const result = await db.query(
    `SELECT p.competition_id, p.user_id, p.joined_at,
            u.name AS user_name, u.timezone AS user_timezone
     FROM competition_participants p
     JOIN users u ON u.id = p.user_id
     WHERE p.competition_id = ANY($1::uuid[])
     ORDER BY p.joined_at, p.user_id`,
    [competitionIds],
  );
  for (const row of result.rows) {
    const participant = mapCompetitionParticipant(row);
    const list = byCompetition.get(participant.competitionId) ?? [];
    list.push(participant);
    byCompetition.set(participant.competitionId, list);
  }
  return byCompetition;
}

export async function isParticipant(
  competitionId: string,
  userId: string,
  db: Queryable = pool,
): Promise<boolean> {
  const result = await db.query(
    'SELECT 1 FROM competition_participants WHERE competition_id = $1 AND user_id = $2',
    [competitionId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Inserts a participant. ON CONFLICT turns a duplicate join into "nothing
 * inserted" rather than an error, which the service reports precisely.
 * The row trigger enforces the five-participant cap on its own as well.
 */
export async function addParticipant(
  params: { competitionId: string; userId: string },
  db: Queryable,
): Promise<boolean> {
  const result = await db.query(
    `INSERT INTO competition_participants (competition_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (competition_id, user_id) DO NOTHING`,
    [params.competitionId, params.userId],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Every goal day of the given users that falls inside the window, from all of
 * their goals. This is the ONLY input to competition scoring: the score is the
 * goal system's own history, never a value a client supplied.
 */
export async function listScoringDays(
  params: { userIds: string[]; startDate: IsoDate; endDate: IsoDate },
  db: Queryable = pool,
): Promise<CompetitionScoringDayRecord[]> {
  if (params.userIds.length === 0) return [];
  const result = await db.query(
    `SELECT g.user_id, d.day_date, d.status, g.status AS goal_status, g.cancelled_at
     FROM goal_days d
     JOIN goals g ON g.id = d.goal_id
     WHERE g.user_id = ANY($1::uuid[])
       AND d.day_date BETWEEN $2::date AND $3::date`,
    [params.userIds, params.startDate, params.endDate],
  );
  return result.rows.map((row) => ({
    userId: row.user_id,
    dayDate: row.day_date,
    status: row.status,
    goalStatus: row.goal_status,
    goalCancelledAt: row.cancelled_at,
  }));
}

export async function insertResults(
  params: {
    competitionId: string;
    rows: Array<{
      userId: string;
      position: number;
      completedDays: number;
      scheduledDays: number;
      scoreBasisPoints: number;
      rewardRarity: Rarity | null;
    }>;
  },
  db: Queryable,
): Promise<void> {
  if (params.rows.length === 0) return;
  await db.query(
    `INSERT INTO competition_results
       (competition_id, user_id, position, completed_days, scheduled_days,
        score_basis_points, reward_rarity)
     SELECT $1, t.user_id, t.position, t.completed_days, t.scheduled_days,
            t.score_basis_points, t.reward_rarity
     FROM unnest($2::uuid[], $3::int[], $4::int[], $5::int[], $6::int[], $7::rarity[])
       AS t(user_id, position, completed_days, scheduled_days, score_basis_points, reward_rarity)`,
    [
      params.competitionId,
      params.rows.map((row) => row.userId),
      params.rows.map((row) => row.position),
      params.rows.map((row) => row.completedDays),
      params.rows.map((row) => row.scheduledDays),
      params.rows.map((row) => row.scoreBasisPoints),
      params.rows.map((row) => row.rewardRarity),
    ],
  );
}

export async function listResults(
  competitionId: string,
  db: Queryable = pool,
): Promise<CompetitionResultRecord[]> {
  const result = await db.query(
    `SELECT r.competition_id, r.user_id, u.name AS user_name, r.position, r.completed_days,
            r.scheduled_days, r.score_basis_points, r.reward_rarity, r.collectible_id,
            r.rewarded_at
     FROM competition_results r
     JOIN users u ON u.id = r.user_id
     WHERE r.competition_id = $1
     ORDER BY r.position, u.name, r.user_id`,
    [competitionId],
  );
  return result.rows.map(mapCompetitionResult);
}

export async function listResultsForUser(
  params: { userId: string; competitionIds: string[] },
  db: Queryable = pool,
): Promise<Map<string, CompetitionResultRecord>> {
  const byCompetition = new Map<string, CompetitionResultRecord>();
  if (params.competitionIds.length === 0) return byCompetition;
  const result = await db.query(
    `SELECT r.competition_id, r.user_id, u.name AS user_name, r.position, r.completed_days,
            r.scheduled_days, r.score_basis_points, r.reward_rarity, r.collectible_id,
            r.rewarded_at
     FROM competition_results r
     JOIN users u ON u.id = r.user_id
     WHERE r.user_id = $1 AND r.competition_id = ANY($2::uuid[])`,
    [params.userId, params.competitionIds],
  );
  for (const row of result.rows) {
    const record = mapCompetitionResult(row);
    byCompetition.set(record.competitionId, record);
  }
  return byCompetition;
}

export async function hasPendingRewards(competitionId: string, db: Queryable = pool): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 FROM competition_results
     WHERE competition_id = $1 AND reward_rarity IS NOT NULL AND rewarded_at IS NULL
     LIMIT 1`,
    [competitionId],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Only succeeds once per row: `rewarded_at IS NULL` is part of the predicate. */
export async function markResultRewarded(
  params: { competitionId: string; userId: string; collectibleId: string },
  db: Queryable,
): Promise<boolean> {
  const result = await db.query(
    `UPDATE competition_results
     SET collectible_id = $3, rewarded_at = now()
     WHERE competition_id = $1 AND user_id = $2
       AND reward_rarity IS NOT NULL AND rewarded_at IS NULL`,
    [params.competitionId, params.userId, params.collectibleId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function markCompetitionFinalized(id: string, db: Queryable): Promise<boolean> {
  const result = await db.query(
    `UPDATE competitions SET finalized_at = now() WHERE id = $1 AND finalized_at IS NULL`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Candidates for the background sweep: unlocked competitions whose end date is
 * behind us, plus locked ones still holding a prize that could not be minted.
 */
export async function listCompetitionIdsNeedingResolution(
  beforeDate: IsoDate,
  db: Queryable = pool,
): Promise<string[]> {
  const result = await db.query(
    `SELECT id FROM competitions WHERE finalized_at IS NULL AND end_date < $1::date
     UNION
     SELECT DISTINCT competition_id FROM competition_results
     WHERE reward_rarity IS NOT NULL AND rewarded_at IS NULL`,
    [beforeDate],
  );
  return result.rows.map((row) => row.id as string);
}
