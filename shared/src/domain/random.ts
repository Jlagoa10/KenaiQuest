/** Returns a float in [0, 1). Injectable so tests stay deterministic. */
export type RandomSource = () => number;

const defaultRandom: RandomSource = Math.random;

/**
 * Fisher-Yates shuffle over a copy of the input.
 * Used ONCE per goal to fix the piece reveal order, which is then persisted.
 */
export function shuffle<T>(items: readonly T[], random: RandomSource = defaultRandom): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i] as T;
    const b = result[j] as T;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

export function range(length: number): number[] {
  return Array.from({ length }, (_, i) => i);
}

export interface WeightedOption<T> {
  value: T;
  weight: number;
}

/**
 * Weighted random pick. Weights do not need to add up to 100 — they are
 * normalised against their own total, which is what lets the admin panel accept
 * any set of positive numbers.
 *
 * Options with weight <= 0 are ignored. Returns null when nothing is selectable,
 * so callers can surface a friendly error instead of crashing.
 */
export function weightedPick<T>(
  options: readonly WeightedOption<T>[],
  random: RandomSource = defaultRandom,
): T | null {
  const selectable = options.filter((option) => option.weight > 0);
  if (selectable.length === 0) return null;

  const total = selectable.reduce((sum, option) => sum + option.weight, 0);
  if (total <= 0) return null;

  let threshold = random() * total;
  for (const option of selectable) {
    threshold -= option.weight;
    if (threshold < 0) return option.value;
  }
  // Floating point guard: return the last selectable option.
  return (selectable[selectable.length - 1] as WeightedOption<T>).value;
}

export function pickOne<T>(items: readonly T[], random: RandomSource = defaultRandom): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(random() * items.length)] as T;
}
