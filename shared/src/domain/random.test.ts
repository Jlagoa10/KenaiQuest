import { describe, expect, it } from 'vitest';
import { pickOne, range, shuffle, weightedPick } from './random.js';

/** Deterministic RNG so the assertions below are exact, not statistical. */
function sequenceRandom(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length] ?? 0;
    index += 1;
    return value;
  };
}

describe('shuffle', () => {
  it('is a permutation: same members, no loss, no duplication', () => {
    const input = range(365);
    const result = shuffle(input);
    expect(result).toHaveLength(365);
    expect(new Set(result).size).toBe(365);
    expect([...result].sort((a, b) => a - b)).toEqual(input);
  });

  it('does not mutate the input', () => {
    const input = range(10);
    shuffle(input);
    expect(input).toEqual(range(10));
  });

  it('actually reorders a large sequence', () => {
    const input = range(365);
    expect(shuffle(input)).not.toEqual(input);
  });
});

describe('weightedPick', () => {
  it('honours the weights', () => {
    const options = [
      { value: 'COMMON', weight: 65 },
      { value: 'RARE', weight: 30 },
      { value: 'EPIC', weight: 5 },
    ];
    expect(weightedPick(options, sequenceRandom([0]))).toBe('COMMON');
    expect(weightedPick(options, sequenceRandom([0.7]))).toBe('RARE');
    expect(weightedPick(options, sequenceRandom([0.99]))).toBe('EPIC');
  });

  it('normalises weights that do not add up to 100', () => {
    const options = [
      { value: 'A', weight: 1 },
      { value: 'B', weight: 3 },
    ];
    expect(weightedPick(options, sequenceRandom([0.1]))).toBe('A');
    expect(weightedPick(options, sequenceRandom([0.9]))).toBe('B');
  });

  it('ignores zero and negative weights', () => {
    const options = [
      { value: 'A', weight: 0 },
      { value: 'B', weight: -5 },
      { value: 'C', weight: 2 },
    ];
    expect(weightedPick(options, sequenceRandom([0]))).toBe('C');
    expect(weightedPick(options, sequenceRandom([0.999]))).toBe('C');
  });

  it('returns null when nothing is selectable instead of throwing', () => {
    expect(weightedPick([])).toBeNull();
    expect(weightedPick([{ value: 'A', weight: 0 }])).toBeNull();
  });
});

describe('pickOne', () => {
  it('returns null for an empty pool', () => {
    expect(pickOne([])).toBeNull();
  });

  it('only ever returns a member of the pool', () => {
    const pool = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i += 1) {
      expect(pool).toContain(pickOne(pool));
    }
  });
});
