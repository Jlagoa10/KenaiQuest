import { describe, expect, it } from 'vitest';
import {
  competitionDurationDays,
  competitionResultsDate,
  competitionRewardRarities,
  computeScoreBasisPoints,
  deriveCompetitionStatus,
  isCompetitionReadyToFinalize,
  rankCompetition,
  rarityForPosition,
  tallyCompetitionDays,
  type CompetitionScoringDay,
} from './competition.js';
import { createCompetitionSchema, inviteCodeSchema } from '../schemas/competition.js';

const WINDOW = { startDate: '2026-10-01', endDate: '2026-10-10' };

function day(
  date: string,
  status: CompetitionScoringDay['status'],
  goalCancelledOn: string | null = null,
): CompetitionScoringDay {
  return { date, status, goalCancelledOn };
}

function entry(userId: string, scoreBasisPoints: number, completedDays = 1) {
  return { userId, scoreBasisPoints, completedDays };
}

describe('computeScoreBasisPoints', () => {
  it('is completed ÷ scheduled in hundredths of a percent', () => {
    expect(computeScoreBasisPoints(19, 20)).toBe(9500);
    expect(computeScoreBasisPoints(1, 3)).toBe(3333);
    expect(computeScoreBasisPoints(2, 3)).toBe(6667);
    expect(computeScoreBasisPoints(0, 10)).toBe(0);
    expect(computeScoreBasisPoints(10, 10)).toBe(10000);
  });

  it('scores 0 when there is nothing to score', () => {
    expect(computeScoreBasisPoints(0, 0)).toBe(0);
  });

  it('gives equivalent fractions exactly the same score', () => {
    expect(computeScoreBasisPoints(1, 2)).toBe(computeScoreBasisPoints(5, 10));
    expect(computeScoreBasisPoints(41, 50)).toBe(computeScoreBasisPoints(82, 100));
  });
});

describe('tallyCompetitionDays', () => {
  const today = '2026-10-06';

  it('only counts days inside the competition window', () => {
    const tally = tallyCompetitionDays({
      ...WINDOW,
      todayInUserTz: '2026-10-20',
      days: [
        day('2026-09-30', 'COMPLETED'),
        day('2026-10-01', 'COMPLETED'),
        day('2026-10-11', 'COMPLETED'),
      ],
    });
    expect(tally).toEqual({ completedDays: 1, scheduledDays: 1, scoreBasisPoints: 10000 });
  });

  it('counts missed days, and pending days whose grace window has closed', () => {
    const tally = tallyCompetitionDays({
      ...WINDOW,
      todayInUserTz: today,
      days: [
        day('2026-10-01', 'COMPLETED'),
        day('2026-10-02', 'MISSED'),
        // Expired but not lazily resolved yet — still a miss.
        day('2026-10-03', 'PENDING'),
        day('2026-10-04', 'COMPLETED'),
      ],
    });
    expect(tally).toEqual({ completedDays: 2, scheduledDays: 4, scoreBasisPoints: 5000 });
  });

  it('does not penalise days that can still be claimed (Hoje / Ontem) or lie in the future', () => {
    const tally = tallyCompetitionDays({
      ...WINDOW,
      todayInUserTz: today,
      days: [
        day('2026-10-04', 'COMPLETED'),
        day('2026-10-05', 'PENDING'), // Ontem
        day('2026-10-06', 'PENDING'), // Hoje
        day('2026-10-07', 'PENDING'), // future
      ],
    });
    expect(tally).toEqual({ completedDays: 1, scheduledDays: 1, scoreBasisPoints: 10000 });
  });

  it('sums every goal of the participant', () => {
    const tally = tallyCompetitionDays({
      ...WINDOW,
      todayInUserTz: '2026-10-20',
      days: [
        day('2026-10-01', 'COMPLETED'),
        day('2026-10-01', 'MISSED'),
        day('2026-10-02', 'COMPLETED'),
        day('2026-10-02', 'COMPLETED'),
      ],
    });
    expect(tally).toEqual({ completedDays: 3, scheduledDays: 4, scoreBasisPoints: 7500 });
  });

  it('keeps the misses of a cancelled goal but drops the days it would never play', () => {
    const tally = tallyCompetitionDays({
      ...WINDOW,
      todayInUserTz: '2026-10-20',
      days: [
        day('2026-10-01', 'COMPLETED', '2026-10-04'),
        day('2026-10-02', 'MISSED', '2026-10-04'),
        day('2026-10-03', 'PENDING', '2026-10-04'),
        day('2026-10-04', 'PENDING', '2026-10-04'),
        day('2026-10-05', 'PENDING', '2026-10-04'),
      ],
    });
    expect(tally).toEqual({ completedDays: 1, scheduledDays: 3, scoreBasisPoints: 3333 });
  });

  it('scores 0% for a participant with no goal days in the window', () => {
    expect(tallyCompetitionDays({ ...WINDOW, todayInUserTz: today, days: [] })).toEqual({
      completedDays: 0,
      scheduledDays: 0,
      scoreBasisPoints: 0,
    });
  });

  it('decides every in-window day once the grace window after the end has closed', () => {
    const tally = tallyCompetitionDays({
      ...WINDOW,
      todayInUserTz: '2026-10-12',
      days: [day('2026-10-09', 'COMPLETED'), day('2026-10-10', 'PENDING')],
    });
    expect(tally.scheduledDays).toBe(2);
  });
});

describe('competitionRewardRarities', () => {
  it('offers the top rarities only to bigger competitions; last place is always Common', () => {
    expect(competitionRewardRarities(2)).toEqual(['UNCOMMON', 'COMMON']);
    expect(competitionRewardRarities(3)).toEqual(['RARE', 'UNCOMMON', 'COMMON']);
    expect(competitionRewardRarities(4)).toEqual(['EPIC', 'RARE', 'UNCOMMON', 'COMMON']);
    expect(competitionRewardRarities(5)).toEqual([
      'LEGENDARY',
      'EPIC',
      'RARE',
      'UNCOMMON',
      'COMMON',
    ]);
  });

  it('offers nothing outside 2–5 participants', () => {
    expect(competitionRewardRarities(0)).toEqual([]);
    expect(competitionRewardRarities(1)).toEqual([]);
    expect(competitionRewardRarities(6)).toEqual([]);
  });
});

describe('rarityForPosition', () => {
  it('maps a position to its rarity for the competition size', () => {
    expect([1, 2, 3, 4, 5].map((position) => rarityForPosition(position, 5))).toEqual([
      'LEGENDARY',
      'EPIC',
      'RARE',
      'UNCOMMON',
      'COMMON',
    ]);
    expect(rarityForPosition(1, 2)).toBe('UNCOMMON');
    expect(rarityForPosition(1, 3)).toBe('RARE');
    expect(rarityForPosition(1, 4)).toBe('EPIC');
    expect(rarityForPosition(4, 4)).toBe('COMMON');
  });

  it('returns null for positions outside the competition', () => {
    expect(rarityForPosition(0, 5)).toBeNull();
    expect(rarityForPosition(6, 5)).toBeNull();
    expect(rarityForPosition(3, 2)).toBeNull();
    expect(rarityForPosition(1, 1)).toBeNull();
  });
});

describe('rankCompetition', () => {
  it('orders by score and assigns one rarity per position', () => {
    const ranked = rankCompetition([
      entry('ana', 4000),
      entry('joao', 9500),
      entry('maria', 7000),
      entry('lucas', 8200),
      entry('pedro', 5500),
    ]);
    expect(ranked.map((row) => [row.userId, row.position, row.rewardRarity])).toEqual([
      ['joao', 1, 'LEGENDARY'],
      ['lucas', 2, 'EPIC'],
      ['maria', 3, 'RARE'],
      ['pedro', 4, 'UNCOMMON'],
      ['ana', 5, 'COMMON'],
    ]);
  });

  it('gives tied participants the same position and the same rarity, then skips', () => {
    const ranked = rankCompetition([
      entry('joao', 9500),
      entry('lucas', 8200),
      entry('maria', 8200),
      entry('pedro', 7000),
      entry('ana', 6000),
    ]);
    expect(ranked.map((row) => [row.userId, row.position, row.rewardRarity])).toEqual([
      ['joao', 1, 'LEGENDARY'],
      ['lucas', 2, 'EPIC'],
      ['maria', 2, 'EPIC'],
      ['pedro', 4, 'UNCOMMON'],
      ['ana', 5, 'COMMON'],
    ]);
  });

  it('is independent of input order for tied participants', () => {
    const a = rankCompetition([entry('x', 5000), entry('y', 5000), entry('z', 9000)]);
    const b = rankCompetition([entry('y', 5000), entry('z', 9000), entry('x', 5000)]);
    const byUser = (rows: typeof a) =>
      Object.fromEntries(rows.map((row) => [row.userId, [row.position, row.rewardRarity]]));
    expect(byUser(a)).toEqual(byUser(b));
    expect(byUser(a)).toEqual({ z: [1, 'RARE'], x: [2, 'UNCOMMON'], y: [2, 'UNCOMMON'] });
  });

  it('shares first place when everyone is tied', () => {
    const ranked = rankCompetition([entry('a', 7000), entry('b', 7000), entry('c', 7000)]);
    expect(ranked.every((row) => row.position === 1 && row.rewardRarity === 'RARE')).toBe(true);
  });

  it.each([
    [2, ['UNCOMMON', 'COMMON']],
    [3, ['RARE', 'UNCOMMON', 'COMMON']],
    [4, ['EPIC', 'RARE', 'UNCOMMON', 'COMMON']],
    [5, ['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON']],
  ])('awards the rarities available with %i participants', (count, rarities) => {
    const ranked = rankCompetition(
      Array.from({ length: count }, (_, index) => entry(`u${index}`, 9000 - index * 1000)),
    );
    expect(ranked.map((row) => row.rewardRarity)).toEqual(rarities);
  });

  it.each([
    // [scores, expected [position, rarity] per row in score order]
    [
      [9000, 9000],
      [
        [1, 'UNCOMMON'],
        [1, 'UNCOMMON'],
      ],
    ],
    [
      [9000, 5000, 5000],
      [
        [1, 'RARE'],
        [2, 'UNCOMMON'],
        [2, 'UNCOMMON'],
      ],
    ],
    [
      [9000, 9000, 5000],
      [
        [1, 'RARE'],
        [1, 'RARE'],
        [3, 'COMMON'],
      ],
    ],
    [
      [9000, 9000, 5000, 4000],
      [
        [1, 'EPIC'],
        [1, 'EPIC'],
        [3, 'UNCOMMON'],
        [4, 'COMMON'],
      ],
    ],
    [
      [9000, 7000, 7000, 7000],
      [
        [1, 'EPIC'],
        [2, 'RARE'],
        [2, 'RARE'],
        [2, 'RARE'],
      ],
    ],
    [
      [9000, 8000, 8000, 6000, 6000],
      [
        [1, 'LEGENDARY'],
        [2, 'EPIC'],
        [2, 'EPIC'],
        [4, 'UNCOMMON'],
        [4, 'UNCOMMON'],
      ],
    ],
  ] as Array<[number[], Array<[number, string]>]>)(
    'gives tied participants the rarity of their shared position (%j)',
    (scores, expected) => {
      const ranked = rankCompetition(scores.map((score, index) => entry(`u${index}`, score)));
      expect(ranked.map((row) => [row.position, row.rewardRarity])).toEqual(expected);
    },
  );

  it('rewards nobody in a solo competition', () => {
    const [only] = rankCompetition([entry('solo', 10000, 10)]);
    expect(only?.position).toBe(1);
    expect(only?.positionRarity).toBeNull();
    expect(only?.rewardEligible).toBe(false);
    expect(only?.rewardRarity).toBeNull();
  });

  it('rewards nobody who completed no day at all, even when tied for first', () => {
    const ranked = rankCompetition([entry('a', 0, 0), entry('b', 0, 0)]);
    expect(ranked.map((row) => [row.position, row.rewardRarity])).toEqual([
      [1, null],
      [1, null],
    ]);
  });

  it('still ranks a 0% participant and rewards the others normally', () => {
    const ranked = rankCompetition([entry('a', 8000), entry('b', 0, 0), entry('c', 6000)]);
    expect(ranked.map((row) => [row.userId, row.position, row.rewardRarity])).toEqual([
      ['a', 1, 'RARE'],
      ['c', 2, 'UNCOMMON'],
      ['b', 3, null],
    ]);
  });
});

describe('competition lifecycle', () => {
  it('derives UPCOMING, ACTIVE and FINISHED', () => {
    const base = { startDate: '2026-10-01', isFinalized: false };
    expect(deriveCompetitionStatus({ ...base, todayInCompetitionTz: '2026-09-30' })).toBe(
      'UPCOMING',
    );
    expect(deriveCompetitionStatus({ ...base, todayInCompetitionTz: '2026-10-01' })).toBe('ACTIVE');
    expect(deriveCompetitionStatus({ ...base, todayInCompetitionTz: '2026-12-01' })).toBe('ACTIVE');
    expect(
      deriveCompetitionStatus({ ...base, todayInCompetitionTz: '2026-12-01', isFinalized: true }),
    ).toBe('FINISHED');
  });

  it('locks the result only after the Ontem window has closed for every participant', () => {
    const endDate = '2026-10-10';
    expect(isCompetitionReadyToFinalize({ endDate, todaysInParticipantTz: ['2026-10-11'] })).toBe(
      false,
    );
    expect(isCompetitionReadyToFinalize({ endDate, todaysInParticipantTz: ['2026-10-12'] })).toBe(
      true,
    );
    expect(
      isCompetitionReadyToFinalize({
        endDate,
        todaysInParticipantTz: ['2026-10-12', '2026-10-11'],
      }),
    ).toBe(false);
    expect(competitionResultsDate(endDate)).toBe('2026-10-12');
  });

  it('measures duration inclusively', () => {
    expect(competitionDurationDays('2026-10-01', '2026-10-07')).toBe(7);
  });
});

describe('competition schemas', () => {
  it('accepts a valid competition and trims the name', () => {
    const parsed = createCompetitionSchema.parse({
      name: '  Desafio de outubro ',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });
    expect(parsed.name).toBe('Desafio de outubro');
  });

  it('rejects an end before the start and lengths outside 7–365 days', () => {
    const base = { name: 'Desafio', startDate: '2026-10-10' };
    expect(createCompetitionSchema.safeParse({ ...base, endDate: '2026-10-01' }).success).toBe(
      false,
    );
    expect(createCompetitionSchema.safeParse({ ...base, endDate: '2026-10-15' }).success).toBe(
      false,
    );
    expect(createCompetitionSchema.safeParse({ ...base, endDate: '2026-10-16' }).success).toBe(
      true,
    );
    expect(createCompetitionSchema.safeParse({ ...base, endDate: '2027-10-10' }).success).toBe(
      false,
    );
  });

  it('rejects impossible dates without throwing', () => {
    expect(
      createCompetitionSchema.safeParse({
        name: 'Desafio',
        startDate: '2026-02-30',
        endDate: '2026-03-30',
      }).success,
    ).toBe(false);
  });

  it('normalises invitation codes typed by hand', () => {
    expect(inviteCodeSchema.parse(' abcd2345 ')).toBe('ABCD2345');
    expect(inviteCodeSchema.safeParse('ABCD0123').success).toBe(false);
    expect(inviteCodeSchema.safeParse('ABC').success).toBe(false);
  });
});
