import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const { Pool, types } = pg;

// DATE columns must stay calendar dates. Without this, node-postgres hands back
// a JS Date built in the server's local timezone, which silently shifts a goal
// day across midnight for any server not running in UTC.
types.setTypeParser(types.builtins.DATE, (value: string) => value);
// NUMERIC defaults to string to protect precision; our values are small and are
// always consumed as numbers.
types.setTypeParser(types.builtins.NUMERIC, (value: string) => Number.parseFloat(value));
types.setTypeParser(types.builtins.INT8, (value: string) => Number.parseInt(value, 10));

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Supabase's pooler terminates TLS with its own certificate chain; verifying
  // it is handled by the connection string's sslmode, so we only need to opt in.
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (error) => {
  logger.error({ err: error }, 'Erro inesperado no pool do PostgreSQL');
});

export async function closePool(): Promise<void> {
  await pool.end();
}
