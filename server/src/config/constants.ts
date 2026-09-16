/** Server-side constants that are not product rules (those live in @kenai/shared). */

export const REFRESH_COOKIE_NAME = 'kq_refresh';

/** The refresh cookie is only ever sent to the endpoints that rotate it. */
export const REFRESH_COOKIE_PATH = '/api/auth';

export const BCRYPT_ROUNDS = 12;

/** Composited goal/collectible images cached in memory, keyed by content version. */
export const IMAGE_CACHE_MAX_ENTRIES = 200;

/** Source artwork binaries cached in memory to avoid re-downloading per reveal. */
export const ARTWORK_CACHE_MAX_ENTRIES = 32;

/**
 * Advisory lock namespace for per-user goal creation. Keeps the "max 3 active
 * goals" check race free without locking the whole table.
 */
export const GOAL_CREATION_LOCK_NAMESPACE = 4711;
