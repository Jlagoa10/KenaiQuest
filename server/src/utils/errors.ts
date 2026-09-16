/**
 * Application error taxonomy.
 *
 * Every error the API returns carries a stable machine code and a
 * Portuguese message safe to show the user. Internal details, stack traces and
 * database messages never cross this boundary — the error handler logs them and
 * returns a generic message instead (spec section 54).
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, string[]>;
  /** Marks errors that are safe to surface verbatim. */
  readonly isOperational = true;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    if (details) this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}

export const badRequest = (code: string, message: string, details?: Record<string, string[]>) =>
  new AppError(400, code, message, details);

export const unauthorized = (message = 'Sessão expirada. Entre novamente.') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Você não tem permissão para acessar este recurso.') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Recurso não encontrado.') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (code: string, message: string) => new AppError(409, code, message);

export const unprocessable = (code: string, message: string) => new AppError(422, code, message);

export const tooManyRequests = (message = 'Muitas tentativas. Tente novamente em instantes.') =>
  new AppError(429, 'TOO_MANY_REQUESTS', message);

export const internal = (message = 'Algo deu errado. Tente novamente em instantes.') =>
  new AppError(500, 'INTERNAL_ERROR', message);

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Stable codes referenced by the client for behaviour, not just display. */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  EMAIL_IN_USE: 'EMAIL_IN_USE',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACTIVE_GOAL_LIMIT: 'ACTIVE_GOAL_LIMIT',
  INVALID_START_DATE: 'INVALID_START_DATE',
  NO_ARTWORK_AVAILABLE: 'NO_ARTWORK_AVAILABLE',
  DAY_NOT_CLAIMABLE: 'DAY_NOT_CLAIMABLE',
  DAY_ALREADY_COMPLETED: 'DAY_ALREADY_COMPLETED',
  DAY_MISSED: 'DAY_MISSED',
  GOAL_NOT_ACTIVE: 'GOAL_NOT_ACTIVE',
  GOAL_NOT_STARTED: 'GOAL_NOT_STARTED',
  COLLECTIBLE_NOT_TRADABLE: 'COLLECTIBLE_NOT_TRADABLE',
  COLLECTIBLE_NOT_LISTED: 'COLLECTIBLE_NOT_LISTED',
  NOT_COLLECTIBLE_OWNER: 'NOT_COLLECTIBLE_OWNER',
  TRADE_OFFER_NOT_PENDING: 'TRADE_OFFER_NOT_PENDING',
  TRADE_SELF: 'TRADE_SELF',
  DUPLICATE_TRADE_OFFER: 'DUPLICATE_TRADE_OFFER',
  ARTWORK_IN_USE: 'ARTWORK_IN_USE',
  LAST_ADMIN: 'LAST_ADMIN',
  UPLOAD_INVALID: 'UPLOAD_INVALID',
} as const;
