import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildDateSequence,
  compareIsoDates,
  differenceInDays,
  formatIsoDatePtBr,
  isIsoDate,
} from './dates.js';

describe('isIsoDate', () => {
  it('accepts well formed calendar dates', () => {
    expect(isIsoDate('2026-09-16')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
  });

  it('rejects malformed input and impossible dates', () => {
    expect(isIsoDate('16/09/2026')).toBe(false);
    expect(isIsoDate('2026-9-16')).toBe(false);
    expect(isIsoDate('2025-02-30')).toBe(false);
    expect(isIsoDate('2025-13-01')).toBe(false);
    expect(isIsoDate(20260916)).toBe(false);
  });
});

describe('addDays', () => {
  it('crosses months, years and leap days', () => {
    expect(addDays('2026-09-16', 1)).toBe('2026-09-17');
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('spans a full 365 day goal', () => {
    expect(addDays('2026-01-01', 364)).toBe('2026-12-31');
  });
});

describe('differenceInDays', () => {
  it('counts whole days in both directions', () => {
    expect(differenceInDays('2026-09-16', '2026-09-17')).toBe(1);
    expect(differenceInDays('2026-09-17', '2026-09-16')).toBe(-1);
    expect(differenceInDays('2026-09-16', '2026-09-16')).toBe(0);
  });
});

describe('buildDateSequence', () => {
  it('materialises one entry per goal day', () => {
    const sequence = buildDateSequence('2026-09-16', 7);
    expect(sequence).toHaveLength(7);
    expect(sequence[0]).toBe('2026-09-16');
    expect(sequence[6]).toBe('2026-09-22');
    expect(new Set(sequence).size).toBe(7);
  });

  it('handles the maximum duration without gaps', () => {
    const sequence = buildDateSequence('2026-01-01', 365);
    expect(sequence).toHaveLength(365);
    expect(new Set(sequence).size).toBe(365);
    expect(sequence[364]).toBe('2026-12-31');
  });
});

describe('compareIsoDates and formatting', () => {
  it('orders dates lexicographically, which matches chronology for ISO dates', () => {
    expect(compareIsoDates('2026-09-16', '2026-09-17')).toBe(-1);
    expect(compareIsoDates('2026-10-01', '2026-09-30')).toBe(1);
    expect(compareIsoDates('2026-09-16', '2026-09-16')).toBe(0);
  });

  it('formats for Brazilian users without timezone drift', () => {
    expect(formatIsoDatePtBr('2026-09-16')).toBe('16/09/2026');
    expect(formatIsoDatePtBr('2026-01-01')).toBe('01/01/2026');
  });
});
