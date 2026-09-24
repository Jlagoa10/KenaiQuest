import {
  COMPETITION_REWARD_RARITY_LADDER,
  MIN_PARTICIPANTS_FOR_REWARDS,
  type CompetitionStatus,
} from '../constants/competitions.js';
import type { GoalDayStatus } from '../constants/goals.js';
import type { Rarity } from '../constants/rarity.js';
import { compareIsoDates, differenceInDays, addDays, type IsoDate } from './dates.js';
import { hasGraceWindowExpired } from './goalProgress.js';
import { COMPLETION_GRACE_DAYS } from '../constants/goals.js';

/**
 * Competition scoring, ranking and lifecycle.
 *
 * Pure functions on purpose: the server feeds them rows straight from
 * `goal_days`, so there is no second progress system to drift from the goals,
 * and every rule here is unit-tested without a database.
 */

/* -------------------------------------------------------------------------
 * Scoring
 * ------------------------------------------------------------------------- */

/** One `goal_days` row of a participant, as the scorer needs it. */
export interface CompetitionScoringDay {
  date: IsoDate;
  status: GoalDayStatus;
  /**
   * Calendar date (in the goal owner's timezone) the goal was cancelled, or
   * null when it was not. Days before it still count; days from it onward were
   * never going to be played and are dropped.
   */
  goalCancelledOn: IsoDate | null;
}

export interface CompetitionTally {
  completedDays: number;
  /** Goal days inside the window that are already decided. The denominator. */
  scheduledDays: number;
  /** Completion in hundredths of a percent (0–10000). The ranking key. */
  scoreBasisPoints: number;
}

/**
 * Completion percentage in basis points, rounded half-up with integer
 * arithmetic so the same inputs produce the same integer on every runtime.
 * The ranking compares these integers, and the UI shows exactly this value, so
 * two people displayed with the same score always share a position.
 */
export function computeScoreBasisPoints(completedDays: number, scheduledDays: number): number {
  if (scheduledDays <= 0) return 0;
  return Math.floor((completedDays * 20000 + scheduledDays) / (2 * scheduledDays));
}

export function basisPointsToPercent(basisPoints: number): number {
  return basisPoints / 100;
}

/**
 * Counts a participant's goal days inside the competition window.
 *
 *   COMPLETED                          counts, and scores
 *   MISSED                             counts
 *   PENDING, grace window closed       counts (it is missed; the goal's own lazy
 *                                      resolution may simply not have run yet)
 *   PENDING, still Hoje/Ontem/future   not decided yet — ignored for now, so an
 *                                      unmarked "today" never drags a live score down
 *   cancelled goal, before cancelling  counts (cancelling cannot erase a miss)
 *   cancelled goal, from cancelling on ignored (unless it was completed)
 *
 * Every goal of the participant takes part — nobody can choose a subset. Once
 * the grace window after the end date has closed, every in-window day is
 * decided, which is why the same function yields the final score.
 */
export function tallyCompetitionDays(params: {
  days: readonly CompetitionScoringDay[];
  startDate: IsoDate;
  endDate: IsoDate;
  todayInUserTz: IsoDate;
}): CompetitionTally {
  const { days, startDate, endDate, todayInUserTz } = params;
  let completedDays = 0;
  let scheduledDays = 0;

  for (const day of days) {
    if (compareIsoDates(day.date, startDate) < 0 || compareIsoDates(day.date, endDate) > 0) {
      continue;
    }

    if (day.status === 'COMPLETED') {
      completedDays += 1;
      scheduledDays += 1;
      continue;
    }

    if (day.goalCancelledOn !== null) {
      if (compareIsoDates(day.date, day.goalCancelledOn) < 0) scheduledDays += 1;
      continue;
    }

    if (day.status === 'MISSED' || hasGraceWindowExpired(day.date, todayInUserTz)) {
      scheduledDays += 1;
    }
  }

  return {
    completedDays,
    scheduledDays,
    scoreBasisPoints: computeScoreBasisPoints(completedDays, scheduledDays),
  };
}

/* -------------------------------------------------------------------------
 * Ranking
 * ------------------------------------------------------------------------- */

export interface CompetitionRankInput {
  userId: string;
  completedDays: number;
  scoreBasisPoints: number;
}

export interface CompetitionRankOutput {
  /** 1-based, shared by ties ("1, 2, 2, 4"). */
  position: number;
  /** The rarity this position stands for, whether or not it will be awarded. */
  positionRarity: Rarity | null;
  /** Whether this participant earns a Kenai at all (see rewardIneligibility). */
  rewardEligible: boolean;
  /** What is (or would be, if the competition ended now) awarded. */
  rewardRarity: Rarity | null;
}

/**
 * The rarities on offer in a competition of this size, indexed by position − 1.
 *
 *   2 participants  Incomum, Comum
 *   3 participants  Raro, Incomum, Comum
 *   4 participants  Épico, Raro, Incomum, Comum
 *   5 participants  Lendário, Épico, Raro, Incomum, Comum
 *
 * Empty below MIN_PARTICIPANTS_FOR_REWARDS (nothing is awarded) and above the
 * participant cap (cannot happen).
 */
export function competitionRewardRarities(participantCount: number): Rarity[] {
  if (
    !Number.isInteger(participantCount) ||
    participantCount < MIN_PARTICIPANTS_FOR_REWARDS ||
    participantCount > COMPETITION_REWARD_RARITY_LADDER.length
  ) {
    return [];
  }
  return COMPETITION_REWARD_RARITY_LADDER.slice(-participantCount);
}

/** The rarity a final position stands for in a competition of this size. */
export function rarityForPosition(position: number, participantCount: number): Rarity | null {
  if (!Number.isInteger(position) || position < 1) return null;
  return competitionRewardRarities(participantCount)[position - 1] ?? null;
}

/**
 * Standard competition ranking: a participant's position is one plus the number
 * of participants with a strictly higher score. Tied participants therefore
 * share a position — and with it the same rarity — and the next position
 * skips accordingly. There is deliberately no tie-breaker. Which rarity a
 * position stands for depends on how many took part (competitionRewardRarities).
 *
 * Anti-farming: nobody is rewarded when fewer than MIN_PARTICIPANTS_FOR_REWARDS
 * took part, and a participant who completed no day at all earns nothing.
 *
 * The output is ordered by position; ties keep the input order, which carries
 * no advantage because tied rows share everything that matters.
 */
export function rankCompetition<T extends CompetitionRankInput>(
  entries: readonly T[],
): Array<T & CompetitionRankOutput> {
  const rewardsEnabled = entries.length >= MIN_PARTICIPANTS_FOR_REWARDS;

  const ranked = entries.map((entry) => {
    const position =
      1 + entries.filter((other) => other.scoreBasisPoints > entry.scoreBasisPoints).length;
    const positionRarity = rarityForPosition(position, entries.length);
    const rewardEligible = rewardsEnabled && entry.completedDays > 0 && positionRarity !== null;
    return {
      ...entry,
      position,
      positionRarity,
      rewardEligible,
      rewardRarity: rewardEligible ? positionRarity : null,
    };
  });

  return ranked
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.position - b.entry.position || a.index - b.index)
    .map(({ entry }) => entry);
}

/* -------------------------------------------------------------------------
 * Lifecycle
 * ------------------------------------------------------------------------- */

/** Inclusive length of the competition, in days. */
export function competitionDurationDays(startDate: IsoDate, endDate: IsoDate): number {
  return differenceInDays(startDate, endDate) + 1;
}

/**
 * UPCOMING until the start date (in the competition's timezone), FINISHED once
 * the final ranking has been stored, ACTIVE in between — including the short
 * Hoje/Ontem grace window after the end date, when the last day can still be
 * claimed and the ranking can therefore still move.
 */
export function deriveCompetitionStatus(params: {
  startDate: IsoDate;
  todayInCompetitionTz: IsoDate;
  isFinalized: boolean;
}): CompetitionStatus {
  if (params.isFinalized) return 'FINISHED';
  if (compareIsoDates(params.todayInCompetitionTz, params.startDate) < 0) return 'UPCOMING';
  return 'ACTIVE';
}

/**
 * The final ranking can only be locked once nobody can still claim a day
 * inside the window: the end date's grace window must have closed for every
 * participant, each in their own timezone.
 */
export function isCompetitionReadyToFinalize(params: {
  endDate: IsoDate;
  todaysInParticipantTz: readonly IsoDate[];
}): boolean {
  return params.todaysInParticipantTz.every((today) =>
    hasGraceWindowExpired(params.endDate, today),
  );
}

/** First calendar date on which the result can be locked. Display only. */
export function competitionResultsDate(endDate: IsoDate): IsoDate {
  return addDays(endDate, COMPLETION_GRACE_DAYS + 1);
}
