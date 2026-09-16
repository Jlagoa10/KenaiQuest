import type pg from 'pg';
import type {
  CompletionTarget,
  GoalDayDto,
  GoalDetailDto,
  GoalStatus,
  GoalSummaryDto,
  IsoDate,
} from '@kenai/shared';
import {
  COMPLETION_GRACE_DAYS,
  MAX_ACTIVE_GOALS,
  addDays,
  compareIsoDates,
  buildDateSequence,
  isDayStillClaimable,
  range,
  resolveCompletionTargetDate,
  shuffle,
  summariseGoalProgress,
} from '@kenai/shared';
import { GOAL_CREATION_LOCK_NAMESPACE } from '../config/constants.js';
import { acquireAdvisoryLock, withTransaction } from '../database/transaction.js';
import type { Queryable } from '../database/types.js';
import { pool } from '../database/pool.js';
import { AppError, ErrorCodes, forbidden, notFound } from '../utils/errors.js';
import { shortHash } from '../utils/crypto.js';
import { currentDateInTimezone } from '../utils/timezone.js';
import * as goalRepository from '../repositories/goalRepository.js';
import * as goalDayRepository from '../repositories/goalDayRepository.js';
import * as artworkRepository from '../repositories/artworkRepository.js';
import * as collectibleRepository from '../repositories/collectibleRepository.js';
import { selectReward } from './rewardEngine.js';
import type { ArtworkRecord, GoalDayRecord, GoalRecord, UserRecord } from '../types/models.js';

/* -------------------------------------------------------------------------
 * Missed-day resolution
 *
 * A pending day becomes permanently MISSED once its Hoje/Ontem window closes.
 * That has to happen whether or not the user is online, and whether or not a
 * scheduled job ran.
 *
 * The design: resolution is LAZY, TRANSACTIONAL and IDEMPOTENT. Every read or
 * write that touches a goal first takes a row lock on it and runs one set-based
 * UPDATE that closes expired days, then finalises the goal if it is over. The
 * cutoff is computed from the OWNER's timezone, never the server's.
 *
 * Because the operation only ever moves PENDING -> MISSED and is guarded by the
 * row lock, running it twice — or concurrently from two requests — converges on
 * the same state. jobs/resolveStaleGoals.ts calls exactly this function across
 * all active goals; it is an optimisation for freshness, never a correctness
 * dependency.
 * ------------------------------------------------------------------------- */

export interface ResolvedGoalState {
  goal: GoalRecord;
  todayInUserTz: IsoDate;
  finalized: boolean;
  collectibleId: string | null;
}

export async function resolveGoalState(
  params: { goalId: string; timezone: string; now?: Date },
  client: pg.PoolClient,
): Promise<ResolvedGoalState | null> {
  const goal = await goalRepository.findGoalByIdForUpdate(params.goalId, client);
  if (!goal) return null;

  const todayInUserTz = currentDateInTimezone(params.timezone, params.now);

  if (goal.status !== 'ACTIVE') {
    const existing = await collectibleRepository.findCollectibleByGoalId(goal.id, client);
    return {
      goal,
      todayInUserTz,
      finalized: false,
      collectibleId: existing?.id ?? null,
    };
  }

  // Earliest date still claimable today.
  const cutoffDate = addDays(todayInUserTz, -COMPLETION_GRACE_DAYS);
  await goalDayRepository.resolveExpiredDays({ goalId: goal.id, cutoffDate }, client);

  const counts = await goalRepository.countGoalDayStatuses(goal.id, client);

  // The goal ends once no day can still be claimed: every day is resolved, or
  // the remaining pending days have all fallen outside the grace window.
  if (counts.pending > 0) {
    return { goal, todayInUserTz, finalized: false, collectibleId: null };
  }

  const finalized = await finalizeGoal({ goal, client });
  return {
    goal: finalized.goal,
    todayInUserTz,
    finalized: finalized.created,
    collectibleId: finalized.collectibleId,
  };
}

/**
 * Turns a finished goal into a collectible.
 *
 * Runs in the caller's transaction and is protected by `collectibles.source_goal_id
 * UNIQUE`, so two concurrent requests can never mint two copies of the same reward.
 * A cancelled goal never reaches this path, which is how deleting a goal forfeits
 * the reward (spec sections 23 and 24).
 */
async function finalizeGoal(params: {
  goal: GoalRecord;
  client: pg.PoolClient;
}): Promise<{ goal: GoalRecord; created: boolean; collectibleId: string | null }> {
  const { goal, client } = params;

  const existing = await collectibleRepository.findCollectibleByGoalId(goal.id, client);
  if (existing) {
    const updated = (await goalRepository.findGoalById(goal.id, client)) ?? goal;
    return { goal: updated, created: false, collectibleId: existing.id };
  }

  const completedPieces = await goalDayRepository.listCompletedPieceIndexes(goal.id, client);
  const completedGoal = await goalRepository.markGoalCompleted(goal.id, client);
  if (!completedGoal) {
    // Another transaction finalised it first.
    const current = (await goalRepository.findGoalById(goal.id, client)) ?? goal;
    const collectible = await collectibleRepository.findCollectibleByGoalId(goal.id, client);
    return { goal: current, created: false, collectibleId: collectible?.id ?? null };
  }

  // The copy enters the collection even when incomplete (spec section 23).
  const collectible = await collectibleRepository.createCollectible(
    {
      ownerId: goal.userId,
      earnedByUserId: goal.userId,
      artworkId: goal.artworkId,
      sourceGoalId: goal.id,
      goalTitle: goal.title,
      totalPieces: goal.totalPieces,
      piecesObtained: completedPieces.length,
      ownedPieceIndexes: completedPieces,
    },
    client,
  );

  return { goal: completedGoal, created: true, collectibleId: collectible.id };
}

/* -------------------------------------------------------------------------
 * Goal creation
 * ------------------------------------------------------------------------- */

export async function createGoal(params: {
  user: UserRecord;
  title: string;
  description?: string;
  durationDays: number;
  startDate: IsoDate;
  now?: Date;
}): Promise<GoalSummaryDto> {
  const today = currentDateInTimezone(params.user.timezone, params.now);

  // A goal may start today or in the future, never in the past.
  if (compareIsoDates(params.startDate, today) < 0) {
    throw new AppError(
      400,
      ErrorCodes.INVALID_START_DATE,
      'A data de início não pode estar no passado.',
    );
  }

  return withTransaction(async (client) => {
    // Serialises goal creation per user so two simultaneous requests cannot
    // both observe "2 active goals" and both insert a third.
    await acquireAdvisoryLock(client, GOAL_CREATION_LOCK_NAMESPACE, params.user.id);

    const activeCount = await goalRepository.countActiveGoals(params.user.id, client);
    if (activeCount >= MAX_ACTIVE_GOALS) {
      throw new AppError(
        409,
        ErrorCodes.ACTIVE_GOAL_LIMIT,
        `Você pode ter no máximo ${MAX_ACTIVE_GOALS} metas ativas.`,
      );
    }

    // The artwork is chosen here and never disclosed until the goal ends.
    const reward = await selectReward({ durationDays: params.durationDays }, client);

    const endDate = addDays(params.startDate, params.durationDays - 1);
    const goal = await goalRepository.createGoal(
      {
        userId: params.user.id,
        title: params.title,
        description: params.description ?? null,
        durationDays: params.durationDays,
        startDate: params.startDate,
        endDate,
        artworkId: reward.artwork.id,
      },
      client,
    );

    // The reveal order is generated ONCE, here, and persisted with the days.
    // Nothing recomputes it afterwards, so a reload never reshuffles the image.
    const pieceIndexes = shuffle(range(params.durationDays));
    const dates = buildDateSequence(params.startDate, params.durationDays);

    await goalDayRepository.createGoalDays({ goalId: goal.id, dates, pieceIndexes }, client);

    const days = await goalDayRepository.listGoalDays(goal.id, client);
    return buildGoalSummary({
      goal,
      days,
      artworkAspectRatio: reward.artwork.width / reward.artwork.height,
      todayInUserTz: today,
      artwork: null,
      collectibleId: null,
    });
  });
}

/* -------------------------------------------------------------------------
 * Daily completion
 * ------------------------------------------------------------------------- */

export async function completeGoalDay(params: {
  user: UserRecord;
  goalId: string;
  target: CompletionTarget;
  now?: Date;
}): Promise<{ goal: GoalDetailDto; revealedPieceIndex: number }> {
  return withTransaction(async (client) => {
    const state = await resolveGoalState(
      { goalId: params.goalId, timezone: params.user.timezone, now: params.now },
      client,
    );
    if (!state) throw notFound('Meta não encontrada.');
    if (state.goal.userId !== params.user.id) throw forbidden('Esta meta não é sua.');

    if (state.goal.status !== 'ACTIVE') {
      throw new AppError(409, ErrorCodes.GOAL_NOT_ACTIVE, 'Esta meta já foi encerrada.');
    }

    const today = state.todayInUserTz;
    // The client sends only "today" or "yesterday"; the actual calendar date is
    // derived here from the user's timezone, so a crafted request cannot target
    // an arbitrary day.
    const targetDate = resolveCompletionTargetDate(params.target, today);
    const cutoffDate = addDays(today, -COMPLETION_GRACE_DAYS);

    const day = await goalDayRepository.findGoalDayByDate(params.goalId, targetDate, client);
    if (!day) {
      throw new AppError(
        400,
        ErrorCodes.GOAL_NOT_STARTED,
        'Esta data não faz parte da sua meta.',
      );
    }
    if (day.status === 'COMPLETED') {
      throw new AppError(409, ErrorCodes.DAY_ALREADY_COMPLETED, 'Este dia já foi concluído.');
    }
    if (day.status === 'MISSED' || !isDayStillClaimable(targetDate, today)) {
      throw new AppError(
        409,
        ErrorCodes.DAY_MISSED,
        'Este dia não pode mais ser concluído. A peça foi perdida.',
      );
    }

    const completed = await goalDayRepository.completeGoalDay(
      { goalId: params.goalId, date: targetDate, cutoffDate, todayDate: today },
      client,
    );
    if (!completed) {
      // Lost a race with a concurrent identical request.
      throw new AppError(409, ErrorCodes.DAY_ALREADY_COMPLETED, 'Este dia já foi concluído.');
    }

    // Completing the final pending day can end the goal immediately.
    const after = await resolveGoalState(
      { goalId: params.goalId, timezone: params.user.timezone, now: params.now },
      client,
    );
    const goalDetail = await buildGoalDetailFromClient({
      goal: after?.goal ?? state.goal,
      todayInUserTz: today,
      collectibleId: after?.collectibleId ?? null,
      client,
    });

    return { goal: goalDetail, revealedPieceIndex: completed.pieceIndex };
  });
}

/* -------------------------------------------------------------------------
 * Cancellation
 * ------------------------------------------------------------------------- */

export async function cancelGoal(params: {
  user: UserRecord;
  goalId: string;
}): Promise<void> {
  await withTransaction(async (client) => {
    const goal = await goalRepository.findGoalByIdForUpdate(params.goalId, client);
    if (!goal) throw notFound('Meta não encontrada.');
    if (goal.userId !== params.user.id) throw forbidden('Esta meta não é sua.');
    if (goal.status !== 'ACTIVE') {
      throw new AppError(409, ErrorCodes.GOAL_NOT_ACTIVE, 'Esta meta já foi encerrada.');
    }

    // Cancelling forfeits the reward: no collectible is ever created for a
    // CANCELLED goal, and because finalisation is the only path that inserts
    // one, there is nothing to clean up.
    await goalRepository.markGoalCancelled(params.goalId, client);
  });
}

/* -------------------------------------------------------------------------
 * Reads
 * ------------------------------------------------------------------------- */

export async function listGoals(params: {
  user: UserRecord;
  status?: GoalStatus;
  now?: Date;
}): Promise<GoalSummaryDto[]> {
  // Resolve stale days first so the dashboard never shows a day that has in
  // fact expired. Each goal is resolved in its own transaction to keep locks short.
  const activeGoals = await goalRepository.listGoalsByUser(params.user.id, 'ACTIVE');
  for (const goal of activeGoals) {
    await withTransaction((client) =>
      resolveGoalState(
        { goalId: goal.id, timezone: params.user.timezone, now: params.now },
        client,
      ),
    );
  }

  const goals = await goalRepository.listGoalsByUser(params.user.id, params.status);
  if (goals.length === 0) return [];

  const today = currentDateInTimezone(params.user.timezone, params.now);
  const summaries: GoalSummaryDto[] = [];

  for (const goal of goals) {
    const days = await goalDayRepository.listGoalDays(goal.id);
    const artwork = await artworkRepository.findArtworkById(goal.artworkId);
    const collectible =
      goal.status === 'COMPLETED'
        ? await collectibleRepository.findCollectibleByGoalId(goal.id)
        : null;

    summaries.push(
      buildGoalSummary({
        goal,
        days,
        artworkAspectRatio: artwork ? artwork.width / artwork.height : 1,
        todayInUserTz: today,
        // Identity is attached ONLY for goals that have ended.
        artwork: goal.status === 'COMPLETED' && artwork ? artwork : null,
        collectibleId: collectible?.id ?? null,
      }),
    );
  }

  return summaries;
}

export async function getGoalDetail(params: {
  user: UserRecord;
  goalId: string;
  now?: Date;
}): Promise<GoalDetailDto> {
  const detail = await withTransaction(async (client) => {
    const state = await resolveGoalState(
      { goalId: params.goalId, timezone: params.user.timezone, now: params.now },
      client,
    );
    if (!state) throw notFound('Meta não encontrada.');
    if (state.goal.userId !== params.user.id) throw forbidden('Esta meta não é sua.');

    return buildGoalDetailFromClient({
      goal: state.goal,
      todayInUserTz: state.todayInUserTz,
      collectibleId: state.collectibleId,
      client,
    });
  });

  return detail;
}

/** Ownership + freshness check used by the image endpoint. */
export async function getGoalForImage(params: {
  user: UserRecord;
  goalId: string;
  now?: Date;
}): Promise<{
  goal: GoalRecord;
  revealedPieceIndexes: number[];
  imageVersion: string;
}> {
  return withTransaction(async (client) => {
    const state = await resolveGoalState(
      { goalId: params.goalId, timezone: params.user.timezone, now: params.now },
      client,
    );
    if (!state) throw notFound('Meta não encontrada.');
    if (state.goal.userId !== params.user.id) throw forbidden('Esta meta não é sua.');

    const revealed = await goalDayRepository.listCompletedPieceIndexes(state.goal.id, client);
    return {
      goal: state.goal,
      revealedPieceIndexes: revealed,
      imageVersion: buildImageVersion(state.goal.id, revealed),
    };
  });
}

/* -------------------------------------------------------------------------
 * DTO assembly
 * ------------------------------------------------------------------------- */

export function buildImageVersion(id: string, pieceIndexes: number[]): string {
  return shortHash(`${id}:${[...pieceIndexes].sort((a, b) => a - b).join(',')}`);
}

async function buildGoalDetailFromClient(params: {
  goal: GoalRecord;
  todayInUserTz: IsoDate;
  collectibleId: string | null;
  client: Queryable;
}): Promise<GoalDetailDto> {
  const { goal, todayInUserTz, collectibleId, client } = params;
  const days = await goalDayRepository.listGoalDays(goal.id, client);
  const artwork = await artworkRepository.findArtworkById(goal.artworkId, client);

  const summary = buildGoalSummary({
    goal,
    days,
    artworkAspectRatio: artwork ? artwork.width / artwork.height : 1,
    todayInUserTz,
    artwork: goal.status === 'COMPLETED' && artwork ? artwork : null,
    collectibleId,
  });

  return {
    ...summary,
    days: days.map((day) => toGoalDayDto(day, todayInUserTz, goal.status)),
  };
}

function toGoalDayDto(
  day: GoalDayRecord,
  todayInUserTz: IsoDate,
  goalStatus: GoalStatus,
): GoalDayDto {
  return {
    id: day.id,
    dayNumber: day.dayNumber,
    date: day.dayDate,
    status: day.status,
    completedAt: day.completedAt ? day.completedAt.toISOString() : null,
    pieceIndex: day.pieceIndex,
    claimable:
      goalStatus === 'ACTIVE' &&
      day.status === 'PENDING' &&
      isDayStillClaimable(day.dayDate, todayInUserTz),
  };
}

function buildGoalSummary(params: {
  goal: GoalRecord;
  days: GoalDayRecord[];
  artworkAspectRatio: number;
  todayInUserTz: IsoDate;
  /** Non-null ONLY once the goal has ended. Never populated for ACTIVE goals. */
  artwork: ArtworkRecord | null;
  collectibleId: string | null;
}): GoalSummaryDto {
  const { goal, days, artworkAspectRatio, todayInUserTz, artwork, collectibleId } = params;

  const completedDays = days.filter((day) => day.status === 'COMPLETED').length;
  const missedDays = days.filter((day) => day.status === 'MISSED').length;
  const revealed = days
    .filter((day) => day.status === 'COMPLETED')
    .map((day) => day.pieceIndex);
  const missed = days.filter((day) => day.status === 'MISSED').map((day) => day.pieceIndex);

  const progress = summariseGoalProgress({
    totalDays: goal.totalPieces,
    completedDays,
    missedDays,
    startDate: goal.startDate,
    endDate: goal.endDate,
    todayInUserTz,
  });

  const findDay = (date: IsoDate) => days.find((day) => day.dayDate === date);
  const todayDay = findDay(todayInUserTz);
  const yesterdayDay = findDay(addDays(todayInUserTz, -1));

  const summary: GoalSummaryDto = {
    id: goal.id,
    title: goal.title,
    description: goal.description,
    status: goal.status,
    durationDays: goal.durationDays,
    totalPieces: goal.totalPieces,
    startDate: goal.startDate,
    endDate: goal.endDate,
    createdAt: goal.createdAt.toISOString(),
    finalizedAt: goal.finalizedAt ? goal.finalizedAt.toISOString() : null,
    progress,
    revealedPieceIndexes: revealed,
    missedPieceIndexes: missed,
    imageAspectRatio: artworkAspectRatio,
    imageVersion: buildImageVersion(goal.id, revealed),
    canCompleteToday: goal.status === 'ACTIVE' && todayDay?.status === 'PENDING',
    canCompleteYesterday: goal.status === 'ACTIVE' && yesterdayDay?.status === 'PENDING',
  };

  // The artwork identity is attached only for ended goals. While a goal is
  // active these keys are absent from the payload entirely — the secret never
  // leaves the server (spec sections 14 and 15).
  if (artwork) {
    summary.artwork = {
      id: artwork.id,
      name: artwork.name,
      description: artwork.description,
      rarity: artwork.rarity,
    };
  }
  if (collectibleId) summary.collectibleId = collectibleId;

  return summary;
}

/** Used by the background sweep. */
export async function resolveAllActiveGoals(now?: Date): Promise<number> {
  const goalIds = await goalRepository.listActiveGoalIds();
  let finalizedCount = 0;

  for (const goalId of goalIds) {
    const owner = await pool.query<{ timezone: string }>(
      `SELECT u.timezone FROM goals g JOIN users u ON u.id = g.user_id WHERE g.id = $1`,
      [goalId],
    );
    const timezone = owner.rows[0]?.timezone;
    if (!timezone) continue;

    const result = await withTransaction((client) =>
      resolveGoalState({ goalId, timezone, now }, client),
    );
    if (result?.finalized) finalizedCount += 1;
  }

  return finalizedCount;
}
