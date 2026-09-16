import type pg from 'pg';

/**
 * Anything that can run a query: the pool itself, or a client bound to an open
 * transaction. Repositories accept this so the same function works inside and
 * outside a transaction without duplication.
 */
export type Queryable = Pick<pg.PoolClient, 'query'>;
