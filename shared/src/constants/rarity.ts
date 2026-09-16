/**
 * Single source of truth for collectible rarity.
 * Mirrors the PostgreSQL enum `rarity` (see migration 001).
 * Never duplicate these strings anywhere else in the codebase.
 */
export const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;

export type Rarity = (typeof RARITIES)[number];

/** Portuguese (Brazil) display labels — the only text the user ever sees. */
export const RARITY_LABELS: Record<Rarity, string> = {
  COMMON: 'Comum',
  UNCOMMON: 'Incomum',
  RARE: 'Rara',
  EPIC: 'Épica',
  LEGENDARY: 'Lendária',
};

/** Ascending order of value. Used for sorting and for "at least this rare" filters. */
export const RARITY_ORDER: Record<Rarity, number> = {
  COMMON: 0,
  UNCOMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4,
};

/**
 * Tailwind-agnostic token names resolved in client/src/styles/theme.css.
 * Keeping them here guarantees server-rendered metadata and client UI agree.
 */
export const RARITY_TOKENS: Record<Rarity, string> = {
  COMMON: 'rarity-common',
  UNCOMMON: 'rarity-uncommon',
  RARE: 'rarity-rare',
  EPIC: 'rarity-epic',
  LEGENDARY: 'rarity-legendary',
};

export function isRarity(value: unknown): value is Rarity {
  return typeof value === 'string' && (RARITIES as readonly string[]).includes(value);
}
