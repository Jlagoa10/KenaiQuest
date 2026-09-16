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

/**
 * How long a just-rotated refresh token keeps working.
 *
 * Two tabs restoring the same session, or a reload landing mid-refresh, both
 * present the same token within a few hundred milliseconds. Without this
 * window, the slower request looks identical to a replayed stolen token and
 * reuse detection would log the user out of every device. A few seconds is
 * ample for a race and far too short to be useful to an attacker who is not
 * already racing the legitimate client.
 */
export const REFRESH_ROTATION_GRACE_MS = 15_000;
