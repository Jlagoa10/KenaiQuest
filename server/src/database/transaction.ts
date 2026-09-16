import type pg from 'pg';
import { pool } from './pool.js';

/**
 * Runs `handler` inside a single transaction, committing on success and rolling
 * back on any thrown error. The client is always released.
 *
 * This is the only place BEGIN/COMMIT is written, so every multi-statement
 * invariant in the product — minting a collectible, swapping two owners — is
 * guaranteed to be all-or-nothing.
 */
export async function withTransaction<T>(
  handler: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // A rollback failure means the connection is already broken; releasing it
      // with an error discards it from the pool, which is what we want.
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Transaction-scoped advisory lock. Serialises a critical section per key
 * without taking row or table locks, and releases automatically at COMMIT or
 * ROLLBACK so a crashed request can never hold it.
 */
export async function acquireAdvisoryLock(
  client: pg.PoolClient,
  namespace: number,
  key: string,
): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [namespace, key]);
}
