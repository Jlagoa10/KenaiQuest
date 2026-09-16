import { PERFECT_COPY_PERCENT, TRADE_ELIGIBILITY_PERCENT } from '../constants/goals.js';

/**
 * Display percentage, rounded to two decimals.
 * Mirrors the PostgreSQL generated column on `collectibles.completion_percent`.
 * Never use this for eligibility decisions — see isTradeEligible.
 */
export function computeCompletionPercent(piecesObtained: number, totalPieces: number): number {
  if (totalPieces <= 0) return 0;
  return Math.round((piecesObtained / totalPieces) * 10000) / 100;
}

/**
 * Trade eligibility uses integer arithmetic on purpose: comparing a rounded
 * percentage against the threshold could, in principle, promote a copy that sits
 * just below 90%. The cross-multiplied form is exact and matches the SQL
 * predicate used by the repository layer, so the API and the database can never
 * disagree about which copies are tradable.
 */
export function isTradeEligible(piecesObtained: number, totalPieces: number): boolean {
  if (totalPieces <= 0) return false;
  return piecesObtained * 100 >= TRADE_ELIGIBILITY_PERCENT * totalPieces;
}

export function isPerfectCopy(piecesObtained: number, totalPieces: number): boolean {
  return totalPieces > 0 && piecesObtained >= totalPieces;
}

export function formatCompletionPercent(percent: number): string {
  const rounded = Math.round(percent * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export { PERFECT_COPY_PERCENT, TRADE_ELIGIBILITY_PERCENT };
