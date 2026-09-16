import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256 bits of entropy, URL-safe. Used for refresh tokens. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Refresh tokens are stored as a SHA-256 digest. A plain hash is correct here
 * (unlike for passwords) because the token is already high-entropy random, so
 * there is nothing to brute force, and lookups must stay index-friendly.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function safeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Short deterministic digest used as a cache-busting image version. */
export function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}
