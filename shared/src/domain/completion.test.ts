import { describe, expect, it } from 'vitest';
import { computeCompletionPercent, isPerfectCopy, isTradeEligible } from './completion.js';
import { MAX_GOAL_DURATION_DAYS, MIN_GOAL_DURATION_DAYS } from '../constants/goals.js';

describe('computeCompletionPercent', () => {
  it('matches the worked example from the spec: 27 of 30 is 90%', () => {
    expect(computeCompletionPercent(27, 30)).toBe(90);
  });

  it('returns 100 for a complete copy and 0 for an empty one', () => {
    expect(computeCompletionPercent(30, 30)).toBe(100);
    expect(computeCompletionPercent(0, 30)).toBe(0);
  });

  it('guards against a zero total', () => {
    expect(computeCompletionPercent(5, 0)).toBe(0);
  });
});

describe('isTradeEligible', () => {
  it('requires at least 90 percent', () => {
    expect(isTradeEligible(27, 30)).toBe(true); // 90%
    expect(isTradeEligible(30, 30)).toBe(true); // 100%
    expect(isTradeEligible(26, 30)).toBe(false); // 86.67%
  });

  it('rejects 89 percent and accepts 90 percent on a 100 piece copy', () => {
    expect(isTradeEligible(89, 100)).toBe(false);
    expect(isTradeEligible(90, 100)).toBe(true);
  });

  it('never promotes a copy that rounds up to 90 from below', () => {
    for (let total = MIN_GOAL_DURATION_DAYS; total <= MAX_GOAL_DURATION_DAYS; total += 1) {
      for (let obtained = 0; obtained <= total; obtained += 1) {
        const exact = (obtained / total) * 100;
        expect(isTradeEligible(obtained, total)).toBe(exact >= 90);
      }
    }
  });

  it('rejects an empty total', () => {
    expect(isTradeEligible(0, 0)).toBe(false);
  });
});

describe('isPerfectCopy', () => {
  it('flags only fully collected copies', () => {
    expect(isPerfectCopy(30, 30)).toBe(true);
    expect(isPerfectCopy(29, 30)).toBe(false);
    expect(isPerfectCopy(0, 0)).toBe(false);
  });
});
