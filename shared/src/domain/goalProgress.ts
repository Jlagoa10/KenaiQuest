import { COMPLETION_GRACE_DAYS } from '../constants/goals.js';
import type { CompletionTarget } from '../constants/goals.js';
import type { GoalDayStatus } from '../constants/goals.js';
import { addDays, compareIsoDates, type IsoDate } from './dates.js';

/**
 * A pending day stays claimable on its own date and for COMPLETION_GRACE_DAYS
 * afterwards. Once that window closes the day is permanently MISSED and its
 * image piece is lost for this copy — it can never come back (spec section 18).
 */
export function isDayStillClaimable(dayDate: IsoDate, todayInUserTz: IsoDate): boolean {
  const earliestClaimable = addDays(todayInUserTz, -COMPLETION_GRACE_DAYS);
  return (
    compareIsoDates(dayDate, earliestClaimable) >= 0 &&
    compareIsoDates(dayDate, todayInUserTz) <= 0
  );
}

/** The calendar date a "Hoje" / "Ontem" choice resolves to, in the user's timezone. */
export function resolveCompletionTargetDate(
  target: CompletionTarget,
  todayInUserTz: IsoDate,
): IsoDate {
  return target === 'today' ? todayInUserTz : addDays(todayInUserTz, -1);
}

/** A pending day whose grace window has already closed. */
export function hasGraceWindowExpired(dayDate: IsoDate, todayInUserTz: IsoDate): boolean {
  return compareIsoDates(dayDate, addDays(todayInUserTz, -COMPLETION_GRACE_DAYS)) < 0;
}

export interface GoalProgressSummary {
  totalDays: number;
  completedDays: number;
  missedDays: number;
  pendingDays: number;
  /** Days already elapsed, capped at the goal length. Drives "Dia X de Y". */
  currentDay: number;
  remainingDays: number;
  progressPercent: number;
}

export function summariseGoalProgress(params: {
  totalDays: number;
  completedDays: number;
  missedDays: number;
  startDate: IsoDate;
  endDate: IsoDate;
  todayInUserTz: IsoDate;
}): GoalProgressSummary {
  const { totalDays, completedDays, missedDays, startDate, endDate, todayInUserTz } = params;
  const pendingDays = Math.max(totalDays - completedDays - missedDays, 0);

  const elapsed =
    compareIsoDates(todayInUserTz, startDate) < 0
      ? 0
      : Math.min(daysBetweenInclusive(startDate, todayInUserTz), totalDays);

  // Counted from the later of today and the start date, so a goal that has not
  // begun yet still reports its full length rather than the distance from now.
  const countFrom = compareIsoDates(todayInUserTz, startDate) < 0 ? startDate : todayInUserTz;
  const remainingDays =
    compareIsoDates(todayInUserTz, endDate) > 0
      ? 0
      : Math.max(daysBetweenInclusive(countFrom, endDate), 0);

  return {
    totalDays,
    completedDays,
    missedDays,
    pendingDays,
    currentDay: elapsed,
    remainingDays,
    progressPercent: totalDays > 0 ? Math.round((completedDays / totalDays) * 10000) / 100 : 0,
  };
}

function daysBetweenInclusive(from: IsoDate, to: IsoDate): number {
  const fromMs = Date.parse(`${from}T00:00:00.000Z`);
  const toMs = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((toMs - fromMs) / 86_400_000) + 1;
}

/** Cell states the puzzle renderer knows how to draw. */
export type PieceState = 'REVEALED' | 'LOCKED' | 'MISSED';

export function pieceStateFromDayStatus(status: GoalDayStatus): PieceState {
  switch (status) {
    case 'COMPLETED':
      return 'REVEALED';
    case 'MISSED':
      return 'MISSED';
    case 'PENDING':
      return 'LOCKED';
  }
}

/**
 * Expands the compact index arrays the API sends into one state per cell.
 *
 * Summary payloads carry only the revealed/missed indexes rather than an entry
 * per piece, which keeps a 365-day goal small on the wire; the renderer needs
 * the expanded form, and deriving it here means the card and the detail page
 * cannot disagree about what a cell shows.
 *
 * `fallback` is what an unlisted piece becomes: still LOCKED for a running
 * goal, permanently MISSED for a finished copy.
 */
export function buildPieceStates(
  totalPieces: number,
  params: {
    revealed: readonly number[];
    missed?: readonly number[];
    fallback?: PieceState;
  },
): Array<{ pieceIndex: number; state: PieceState }> {
  const revealed = new Set(params.revealed);
  const missed = new Set(params.missed ?? []);
  const fallback = params.fallback ?? 'LOCKED';

  return Array.from({ length: totalPieces }, (_, pieceIndex) => ({
    pieceIndex,
    state: revealed.has(pieceIndex)
      ? ('REVEALED' as PieceState)
      : missed.has(pieceIndex)
        ? ('MISSED' as PieceState)
        : fallback,
  }));
}
