import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@kenai/shared';
import { forbidden, unauthorized } from '../utils/errors.js';
import { verifyAccessToken } from '../services/authService.js';
import { findUserById } from '../repositories/userRepository.js';
import type { UserRecord } from '../types/models.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRecord;
    }
  }
}

/**
 * Bearer-token authentication.
 *
 * The user record is loaded on every request rather than trusted from the JWT
 * body, so a role change or a timezone update takes effect immediately instead
 * of waiting for the token to expire.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized();

    const token = header.slice('Bearer '.length).trim();
    if (!token) throw unauthorized();

    const payload = verifyAccessToken(token);
    const user = await findUserById(payload.sub);
    if (!user) throw unauthorized();

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/** Route guard for role-restricted areas. Always used AFTER authenticate. */
export function authorizeRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(forbidden('Acesso restrito a administradores.'));
      return;
    }
    next();
  };
}

/** Narrowing helper so controllers never repeat the null check. */
export function requireUser(req: Request): UserRecord {
  if (!req.user) throw unauthorized();
  return req.user;
}
