import { describe, expect, it } from 'vitest';
import {
  buildPieceStates,
  hasGraceWindowExpired,
  isDayStillClaimable,
  resolveCompletionTargetDate,
  summariseGoalProgress,
} from './goalProgress.js';

describe('isDayStillClaimable', () => {
  // The spec's worked example: September 15 is missed but recoverable on the
  // 16th, and permanently lost on the 17th.
  it('allows today and yesterday only', () => {
    expect(isDayStillClaimable('2026-09-16', '2026-09-16')).toBe(true);
    expect(isDayStillClaimable('2026-09-15', '2026-09-16')).toBe(true);
    expect(isDayStillClaimable('2026-09-15', '2026-09-17')).toBe(false);
    expect(isDayStillClaimable('2026-09-14', '2026-09-16')).toBe(false);
  });

  it('refuses days in the future', () => {
    expect(isDayStillClaimable('2026-09-17', '2026-09-16')).toBe(false);
  });

  it('handles month and year boundaries', () => {
    expect(isDayStillClaimable('2025-12-31', '2026-01-01')).toBe(true);
    expect(isDayStillClaimable('2025-12-31', '2026-01-02')).toBe(false);
    expect(isDayStillClaimable('2026-02-28', '2026-03-01')).toBe(true);
  });
});

describe('hasGraceWindowExpired', () => {
  it('is the exact complement of the claimable window for past days', () => {
    expect(hasGraceWindowExpired('2026-09-15', '2026-09-16')).toBe(false);
    expect(hasGraceWindowExpired('2026-09-15', '2026-09-17')).toBe(true);
  });
});

describe('resolveCompletionTargetDate', () => {
  it('maps Hoje and Ontem onto calendar dates in the user timezone', () => {
    expect(resolveCompletionTargetDate('today', '2026-09-16')).toBe('2026-09-16');
    expect(resolveCompletionTargetDate('yesterday', '2026-09-16')).toBe('2026-09-15');
    expect(resolveCompletionTargetDate('yesterday', '2026-01-01')).toBe('2025-12-31');
  });
});

describe('summariseGoalProgress', () => {
  it('reports day X of Y while the goal is running', () => {
    const summary = summariseGoalProgress({
      totalDays: 30,
      completedDays: 9,
      missedDays: 1,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      todayInUserTz: '2026-09-10',
    });
    expect(summary.currentDay).toBe(10);
    expect(summary.remainingDays).toBe(21);
    expect(summary.pendingDays).toBe(20);
    expect(summary.progressPercent).toBe(30);
  });

  it('reports zero elapsed days before the start date', () => {
    const summary = summariseGoalProgress({
      totalDays: 10,
      completedDays: 0,
      missedDays: 0,
      startDate: '2026-10-01',
      endDate: '2026-10-10',
      todayInUserTz: '2026-09-16',
    });
    expect(summary.currentDay).toBe(0);
    expect(summary.remainingDays).toBe(10);
  });

  it('caps elapsed days and zeroes remaining days after the end date', () => {
    const summary = summariseGoalProgress({
      totalDays: 30,
      completedDays: 27,
      missedDays: 3,
      startDate: '2026-08-01',
      endDate: '2026-08-30',
      todayInUserTz: '2026-09-16',
    });
    expect(summary.currentDay).toBe(30);
    expect(summary.remainingDays).toBe(0);
    expect(summary.pendingDays).toBe(0);
    expect(summary.progressPercent).toBe(90);
  });
});

describe('buildPieceStates', () => {
  it('expands compact index arrays into one state per cell', () => {
    const states = buildPieceStates(5, { revealed: [0, 3], missed: [1] });
    expect(states.map((piece) => piece.state)).toEqual([
      'REVEALED',
      'MISSED',
      'LOCKED',
      'REVEALED',
      'LOCKED',
    ]);
    expect(states.map((piece) => piece.pieceIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it('treats unlisted pieces as permanent holes for a finished copy', () => {
    const states = buildPieceStates(4, { revealed: [1, 2], fallback: 'MISSED' });
    expect(states.map((piece) => piece.state)).toEqual([
      'MISSED',
      'REVEALED',
      'REVEALED',
      'MISSED',
    ]);
  });

  it('marks every piece revealed for a perfect copy', () => {
    const states = buildPieceStates(7, { revealed: [0, 1, 2, 3, 4, 5, 6], fallback: 'MISSED' });
    expect(states.every((piece) => piece.state === 'REVEALED')).toBe(true);
  });

  it('marks nothing revealed for a goal that has just started', () => {
    const states = buildPieceStates(30, { revealed: [] });
    expect(states).toHaveLength(30);
    expect(states.every((piece) => piece.state === 'LOCKED')).toBe(true);
  });

  it('scales to the maximum duration', () => {
    const revealed = Array.from({ length: 200 }, (_, i) => i * 1);
    const states = buildPieceStates(365, { revealed });
    expect(states).toHaveLength(365);
    expect(states.filter((piece) => piece.state === 'REVEALED')).toHaveLength(200);
  });
});
