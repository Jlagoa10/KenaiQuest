/**
 * Migration runner.
 *
 * Plain numbered `.sql` files plus a `schema_migrations` ledger. Every migration
 * runs inside its own transaction, so a failure leaves the database exactly as
 * it was. The same files run against local PostgreSQL and Supabase — there is
 * nothing provider specific in them.
 *
 *   npm run migrate:up        apply all pending migrations
 *   npm run migrate:status    show applied / pending
 *   npm run migrate:down      roll back the most recent migration
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closePool } from './pool.js';
import { withTransaction } from './transaction.js';
import { logger } from '../utils/logger.js';

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

interface Migration {
  id: string;
  name: string;
  upFile: string;
  downFile: string | null;
}

async function ensureLedger(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          text PRIMARY KEY,
      name        text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function discoverMigrations(): Promise<Migration[]> {
  const entries = await fs.readdir(migrationsDir);
  const upFiles = entries
    .filter((file) => file.endsWith('.sql') && !file.endsWith('.down.sql'))
    .sort();

  return upFiles.map((file) => {
    const name = file.replace(/\.sql$/, '');
    const id = name.split('_')[0] ?? name;
    const downFile = `${name}.down.sql`;
    return {
      id,
      name,
      upFile: path.join(migrationsDir, file),
      downFile: entries.includes(downFile) ? path.join(migrationsDir, downFile) : null,
    };
  });
}

async function appliedIds(): Promise<Set<string>> {
  const result = await pool.query<{ id: string }>('SELECT id FROM schema_migrations');
  return new Set(result.rows.map((row) => row.id));
}

async function up(): Promise<void> {
  await ensureLedger();
  const migrations = await discoverMigrations();
  const applied = await appliedIds();
  const pending = migrations.filter((migration) => !applied.has(migration.id));

  if (pending.length === 0) {
    logger.info('Nenhuma migração pendente.');
    return;
  }

  for (const migration of pending) {
    const sql = await fs.readFile(migration.upFile, 'utf8');
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id, name) VALUES ($1, $2)', [
        migration.id,
        migration.name,
      ]);
    });
    logger.info({ migration: migration.name }, 'Migração aplicada');
  }
}

async function down(): Promise<void> {
  await ensureLedger();
  const result = await pool.query<{ id: string; name: string }>(
    'SELECT id, name FROM schema_migrations ORDER BY id DESC LIMIT 1',
  );
  const last = result.rows[0];
  if (!last) {
    logger.info('Nenhuma migração aplicada.');
    return;
  }

  const migrations = await discoverMigrations();
  const migration = migrations.find((candidate) => candidate.id === last.id);
  if (!migration?.downFile) {
    throw new Error(`Migração ${last.name} não possui arquivo .down.sql.`);
  }

  const sql = await fs.readFile(migration.downFile, 'utf8');
  await withTransaction(async (client) => {
    await client.query(sql);
    await client.query('DELETE FROM schema_migrations WHERE id = $1', [last.id]);
  });
  logger.info({ migration: migration.name }, 'Migração revertida');
}

async function status(): Promise<void> {
  await ensureLedger();
  const migrations = await discoverMigrations();
  const applied = await appliedIds();

  const lines = migrations.map(
    (migration) => `  ${applied.has(migration.id) ? '[aplicada]' : '[pendente ]'} ${migration.name}`,
  );
  process.stdout.write(`Migrações:\n${lines.join('\n')}\n`);
}

/** Exported so integration tests can build a schema without shelling out. */
export async function runMigrations(): Promise<void> {
  await up();
}

const command = process.argv[2] ?? 'up';

async function main(): Promise<void> {
  switch (command) {
    case 'up':
      await up();
      break;
    case 'down':
      await down();
      break;
    case 'status':
      await status();
      break;
    default:
      throw new Error(`Comando desconhecido: ${command}. Use up, down ou status.`);
  }
}

// Only run as a CLI when invoked directly, not when imported by tests.
const invokedDirectly = process.argv[1]?.includes('migrate');
if (invokedDirectly) {
  main()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch(async (error: unknown) => {
      logger.error({ err: error }, 'Falha ao executar migrações');
      await closePool().catch(() => undefined);
      process.exit(1);
    });
}
