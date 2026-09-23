/**
 * Background sweep that resolves expired goal days and finalises finished goals,
 * then locks the result of finished competitions and delivers their prizes.
 *
 * This is an OPTIMISATION, not a correctness dependency: every read and write
 * path already resolves a goal's state on access, so the product is correct
 * even if this never runs. What the sweep buys is freshness — a goal that
 * nobody has opened still ends on time, which matters for future notifications
 * and for admin statistics.
 *
 * Run it from any scheduler (cron, Render/Railway cron job, GitHub Actions):
 *   npm run jobs:resolve
 */
import { closePool } from '../database/pool.js';
import { logger } from '../utils/logger.js';
import { resolveAllActiveGoals } from '../services/goalService.js';
import { resolveAllCompetitions } from '../services/competitionService.js';

async function main(): Promise<void> {
  const started = Date.now();
  const finalized = await resolveAllActiveGoals();
  // Competitions score from goal days, so they are locked after the goals are resolved.
  const competitionsFinalized = await resolveAllCompetitions();
  logger.info(
    { finalized, competitionsFinalized, durationMs: Date.now() - started },
    'Varredura de metas e competições concluída',
  );
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (error: unknown) => {
    logger.error({ err: error }, 'Falha na varredura de metas');
    await closePool().catch(() => undefined);
    process.exit(1);
  });
