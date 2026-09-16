/**
 * Calendar-date helpers. A goal day is a calendar date in the USER's timezone,
 * never an instant, so every value here is a plain `yyyy-MM-dd` string and all
 * arithmetic happens in UTC to stay free of local-time drift.
 *
 * Converting "now" into a user-local calendar date is the server's job
 * (server/src/utils/timezone.ts) — this module only manipulates the result.
 */

/** A calendar date formatted as `yyyy-MM-dd`. */
export type IsoDate = string;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(timestamp)) return false;
  // Rejects impossible dates that Date.parse would otherwise roll over (2025-02-30).
  return toIsoDate(new Date(timestamp)) === value;
}

export function toIsoDate(date: Date): IsoDate {
  const year = date.getUTCFullYear().toString().padStart(4, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isoDateToUtcDate(value: IsoDate): Date {
  if (!isIsoDate(value)) throw new Error(`Invalid ISO date: ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const date = isoDateToUtcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

/** Whole days from `from` to `to`. Negative when `to` precedes `from`. */
export function differenceInDays(from: IsoDate, to: IsoDate): number {
  const fromMs = isoDateToUtcDate(from).getTime();
  const toMs = isoDateToUtcDate(to).getTime();
  return Math.round((toMs - fromMs) / 86_400_000);
}

/** -1 when a < b, 0 when equal, 1 when a > b. */
export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function minIsoDate(a: IsoDate, b: IsoDate): IsoDate {
  return compareIsoDates(a, b) <= 0 ? a : b;
}

export function maxIsoDate(a: IsoDate, b: IsoDate): IsoDate {
  return compareIsoDates(a, b) >= 0 ? a : b;
}

/** Inclusive sequence of calendar dates, used to materialise `goal_days`. */
export function buildDateSequence(start: IsoDate, length: number): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let offset = 0; offset < length; offset += 1) {
    dates.push(addDays(start, offset));
  }
  return dates;
}

const PT_BR_DATE = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `2026-09-16` -> `16/09/2026`. Safe for display in any timezone. */
export function formatIsoDatePtBr(value: IsoDate): string {
  return PT_BR_DATE.format(isoDateToUtcDate(value));
}
