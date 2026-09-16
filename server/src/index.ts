import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { closePool, pingDatabase } from './database/pool.js';

async function start(): Promise<void> {
  // Fail fast with a clear message rather than on the first request.
  try {
    await pingDatabase();
  } catch (error) {
    logger.error(
      { err: error },
      'Não foi possível conectar ao PostgreSQL. Verifique DATABASE_URL.',
    );
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, storage: env.STORAGE_DRIVER },
      'Kenai Quest API iniciada',
    );
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Encerrando servidor');
    server.close(() => {
      void closePool().finally(() => process.exit(0));
    });
    // Do not hang forever on a stuck connection.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

void start();
