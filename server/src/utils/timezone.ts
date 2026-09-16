import type { IsoDate } from '@kenai/shared';
import { DEFAULT_TIMEZONE } from '@kenai/shared';

/**
 * Converting an instant into a user-local calendar date.
 *
 * Everything about daily completion depends on this: "Hoje" for a user in
 * America/Sao_Paulo is a different calendar date than for a user in Tokyo at
 * the same instant. Server local time is never consulted — `Intl` resolves the
 * offset, including historical and DST transitions, from the IANA database.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timezone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  formatterCache.set(timezone, formatter);
  return formatter;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The calendar date (`yyyy-MM-dd`) currently in effect for the given timezone.
 * Falls back to the product default if a stored timezone stops being valid.
 */
export function currentDateInTimezone(timezone: string, now: Date = new Date()): IsoDate {
  const zone = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  // en-CA formats as yyyy-MM-dd, which is exactly the IsoDate shape.
  return getFormatter(zone).format(now);
}
