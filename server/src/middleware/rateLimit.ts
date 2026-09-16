import rateLimit, { type Options } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { isTest } from '../config/env.js';
import type { ApiErrorBody } from '@kenai/shared';

function buildHandler(message: string) {
  return (_req: Request, res: Response): void => {
    const body: ApiErrorBody = {
      error: { code: 'TOO_MANY_REQUESTS', message },
    };
    res.status(429).json(body);
  };
}

const shared: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Limits would make the integration suite flaky and prove nothing.
  skip: () => isTest,
};

/** Strict limiter for credential endpoints — the main brute-force surface. */
export const authLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  handler: buildHandler('Muitas tentativas de acesso. Tente novamente em 15 minutos.'),
});

export const registerLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  handler: buildHandler('Muitas contas criadas a partir deste endereço. Tente mais tarde.'),
});

/**
 * Session refresh.
 *
 * Deliberately much more generous than authLimiter. A refresh token is 256 bits
 * of entropy, single use, and reuse-detection burns the whole family, so this is
 * not a credential-guessing surface. It IS on the hot path: the SPA refreshes on
 * every cold page load, so the strict limiter would lock legitimate users out of
 * their own session after a handful of navigations.
 */
export const refreshLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 120,
  handler: buildHandler('Muitas renovações de sessão. Aguarde alguns instantes.'),
});

/** Broad limiter applied to the whole API as a backstop. */
export const apiLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 1000,
  limit: 300,
  handler: buildHandler('Muitas requisições. Aguarde alguns instantes.'),
});

export const uploadLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 60 * 1000,
  limit: 60,
  handler: buildHandler('Muitos envios de arquivo. Tente novamente mais tarde.'),
});
