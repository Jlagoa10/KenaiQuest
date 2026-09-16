import type { CookieOptions, Request, Response } from 'express';
import type { AuthResponseDto, LoginInput, RegisterInput } from '@kenai/shared';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from '../config/constants.js';
import { env, isProduction } from '../config/env.js';
import { unauthorized } from '../utils/errors.js';
import * as authService from '../services/authService.js';

/**
 * The refresh token lives in an httpOnly cookie scoped to /api/auth, so it is
 * never readable by JavaScript and is not attached to ordinary API calls.
 *
 * The access token is returned in the response body and held in memory by the
 * client, then sent as a Bearer header. That combination is deliberately
 * CSRF-proof: API calls carry no ambient credential, and the one endpoint that
 * does — refresh — only ever mints new tokens for whoever already holds the
 * cookie.
 */
function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    // The frontend (Vercel) and the API are on different sites in production.
    sameSite: isProduction ? 'none' : 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

function sendSession(
  res: Response,
  result: Awaited<ReturnType<typeof authService.login>>,
  status = 200,
): void {
  res.cookie(REFRESH_COOKIE_NAME, result.tokens.refreshToken, refreshCookieOptions());

  const body: AuthResponseDto = {
    user: authService.toUserDto(result.user),
    accessToken: result.tokens.accessToken,
    expiresIn: result.tokens.expiresIn,
  };
  res.status(status).json(body);
}

export async function register(req: Request, res: Response): Promise<void> {
  const input = req.body as RegisterInput;
  const result = await authService.register(input);
  sendSession(res, result, 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = req.body as LoginInput;
  const result = await authService.login(input);
  sendSession(res, result);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!token) throw unauthorized();

  const result = await authService.refreshSession(token);
  sendSession(res, result);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  await authService.logout(token);
  res.clearCookie(REFRESH_COOKIE_NAME, { ...refreshCookieOptions(), maxAge: undefined });
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) throw unauthorized();
  res.json({ user: authService.toUserDto(req.user) });
}
