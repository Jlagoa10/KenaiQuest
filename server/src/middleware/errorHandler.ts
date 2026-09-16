import type { NextFunction, Request, Response } from 'express';
import type { ApiErrorBody } from '@kenai/shared';
import { MulterError } from 'multer';
import { MAX_ARTWORK_FILE_BYTES } from '@kenai/shared';
import { isAppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { isProduction } from '../config/env.js';

export function notFoundHandler(_req: Request, res: Response): void {
  const body: ApiErrorBody = {
    error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' },
  };
  res.status(404).json(body);
}

/**
 * Terminal error handler.
 *
 * Operational errors carry a message written for the user and are returned as
 * they are. Anything else is logged with its stack and replaced by a generic
 * message: database errors, driver messages and stack traces never reach the
 * browser (spec section 54).
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (isAppError(error)) {
    const body: ApiErrorBody = {
      error: { code: error.code, message: error.message },
    };
    if (error.details) body.error.details = error.details;

    if (error.statusCode >= 500) {
      logger.error({ err: error, path: req.path }, 'Erro de aplicação');
    }
    res.status(error.statusCode).json(body);
    return;
  }

  if (error instanceof MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? `Arquivo muito grande. O limite é ${Math.round(MAX_ARTWORK_FILE_BYTES / 1024 / 1024)} MB.`
        : 'Não foi possível processar o arquivo enviado.';
    const body: ApiErrorBody = { error: { code: 'UPLOAD_INVALID', message } };
    res.status(422).json(body);
    return;
  }

  logger.error({ err: error, path: req.path, method: req.method }, 'Erro não tratado');

  const body: ApiErrorBody = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Algo deu errado. Tente novamente em instantes.',
    },
  };

  // Outside production the raw message helps local debugging; it is never
  // included in a production response.
  if (!isProduction && error instanceof Error) {
    body.error.details = { debug: [error.message] };
  }

  res.status(500).json(body);
}
