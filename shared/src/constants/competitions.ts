import type { Rarity } from './rarity.js';
import { MAX_GOAL_DURATION_DAYS, MIN_GOAL_DURATION_DAYS } from './goals.js';

/**
 * Competition rules. Imported by the API, the UI and mirrored by the database
 * constraints in migration 004 — change them together.
 */

/** Hard cap, creator included. Enforced in the service, a DB trigger and the UI. */
export const MAX_COMPETITION_PARTICIPANTS = 5;

/**
 * Anti-farming: a competition only awards Kenai when at least this many people
 * took part. A solo competition would otherwise be a free Legendary.
 */
export const MIN_PARTICIPANTS_FOR_REWARDS = 2;

/** Same bounds as a goal, so a competition always spans at least a week of goal days. */
export const MIN_COMPETITION_DURATION_DAYS = MIN_GOAL_DURATION_DAYS;
export const MAX_COMPETITION_DURATION_DAYS = MAX_GOAL_DURATION_DAYS;

export const COMPETITION_NAME_MIN_LENGTH = 3;
export const COMPETITION_NAME_MAX_LENGTH = 60;

/**
 * Invitation codes: no 0/O or 1/I, so a code read aloud or copied by hand is
 * never ambiguous. 32^8 ≈ 10^12 combinations.
 */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;
export const INVITE_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

/**
 * Lifecycle as the product presents it.
 *
 *   UPCOMING  before the start date — people can still join
 *   ACTIVE    from the start date until the result is locked; the ranking is live
 *   FINISHED  final ranking stored, rewards assigned, nothing changes any more
 */
export const COMPETITION_STATUSES = ['UPCOMING', 'ACTIVE', 'FINISHED'] as const;
export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];

export const COMPETITION_STATUS_LABELS: Record<CompetitionStatus, string> = {
  UPCOMING: 'Em breve',
  ACTIVE: 'Em andamento',
  FINISHED: 'Finalizada',
};

/**
 * Reward rarities from best to worst. A competition with N participants awards
 * the last N rungs: last place always earns Common and each position above it
 * one rarity more, so only a full competition (5) reaches Legendary. See
 * competitionRewardRarities in domain/competition.ts.
 */
export const COMPETITION_REWARD_RARITY_LADDER: readonly Rarity[] = [
  'LEGENDARY',
  'EPIC',
  'RARE',
  'UNCOMMON',
  'COMMON',
];
