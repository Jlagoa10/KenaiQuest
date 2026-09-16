/**
 * Non-negotiable product rules (see spec section 68).
 * These are imported by both the API and the UI — never re-typed as literals.
 */

/** Minimum goal duration, in days. */
export const MIN_GOAL_DURATION_DAYS = 7;

/** Maximum goal duration, in days. */
export const MAX_GOAL_DURATION_DAYS = 365;

/** A user may hold at most this many ACTIVE goals at once. Enforced in UI, service and DB. */
export const MAX_ACTIVE_GOALS = 3;

/** Duration that guarantees a LEGENDARY reward. */
export const LEGENDARY_DURATION_DAYS = 365;

/**
 * A pending day may still be completed on its own date or on the following date.
 * Anything older is permanently MISSED. Expressed in days of slack.
 */
export const COMPLETION_GRACE_DAYS = 1;

/** Minimum completion percentage for a collectible to be tradable. */
export const TRADE_ELIGIBILITY_PERCENT = 90;

/** A copy with every piece collected earns the "Cópia perfeita" badge. */
export const PERFECT_COPY_PERCENT = 100;

export const GOAL_TITLE_MIN_LENGTH = 3;
export const GOAL_TITLE_MAX_LENGTH = 80;
export const GOAL_DESCRIPTION_MAX_LENGTH = 500;

/** Which day the user claims to have completed. The API accepts nothing else. */
export const COMPLETION_TARGETS = ['today', 'yesterday'] as const;
export type CompletionTarget = (typeof COMPLETION_TARGETS)[number];

export const COMPLETION_TARGET_LABELS: Record<CompletionTarget, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
};

export const GOAL_STATUSES = ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  ACTIVE: 'Ativa',
  COMPLETED: 'Encerrada',
  CANCELLED: 'Cancelada',
};

export const GOAL_DAY_STATUSES = ['PENDING', 'COMPLETED', 'MISSED'] as const;
export type GoalDayStatus = (typeof GOAL_DAY_STATUSES)[number];

export const GOAL_DAY_STATUS_LABELS: Record<GoalDayStatus, string> = {
  PENDING: 'Pendente',
  COMPLETED: 'Concluído',
  MISSED: 'Perdido',
};
