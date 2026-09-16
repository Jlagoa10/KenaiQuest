import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { allowedOrigins, env, isTest } from './config/env.js';
import { logger } from './utils/logger.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRoutes } from './routes/index.js';
import { forbidden } from './utils/errors.js';

export function createApp(): Express {
  const app = express();

  // Required for correct client IPs behind a reverse proxy, which the rate
  // limiter depends on. Off by default so a misconfigured deploy cannot be
  // trivially spoofed via X-Forwarded-For.
  if (env.TRUST_PROXY) app.set('trust proxy', 1);

  app.disable('x-powered-by');

  app.use(
    helmet({
      // The API only ever returns JSON and PNG; the frontend is a separate origin.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      // Explicit allow list, never a wildcard: credentials are in play.
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(forbidden('Origem não permitida.'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());

  if (!isTest) {
    app.use(
      pinoHttp({
        logger,
        // Health checks would otherwise dominate the log.
        autoLogging: { ignore: (req: { url?: string }) => req.url === '/api/health' },
      }),
    );
  }

  app.use('/api', apiLimiter, apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
