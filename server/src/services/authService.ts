import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import type { UserDto, UserRole } from '@kenai/shared';
import { DEFAULT_TIMEZONE } from '@kenai/shared';
import { env } from '../config/env.js';
import { BCRYPT_ROUNDS } from '../config/constants.js';
import { AppError, ErrorCodes, unauthorized } from '../utils/errors.js';
import { generateOpaqueToken, hashToken } from '../utils/crypto.js';
import { isValidTimezone } from '../utils/timezone.js';
import * as userRepository from '../repositories/userRepository.js';
import * as refreshTokenRepository from '../repositories/refreshTokenRepository.js';
import type { UserRecord } from '../types/models.js';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function toUserDto(user: UserRecord): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    timezone: user.timezone,
    themePreference: user.themePreference,
    createdAt: user.createdAt.toISOString(),
  };
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function signAccessToken(user: UserRecord): string {
  const payload: AccessTokenPayload = { sub: user.id, role: user.role };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_TOKEN_TTL_SECONDS,
    issuer: 'kenai-quest',
    audience: 'kenai-quest-api',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'kenai-quest',
      audience: 'kenai-quest-api',
    });
    if (typeof decoded === 'string' || !decoded.sub) throw new Error('Token inválido');
    return { sub: decoded.sub, role: (decoded as jwt.JwtPayload).role as UserRole };
  } catch {
    throw unauthorized();
  }
}

async function issueSession(user: UserRecord, familyId: string = randomUUID()): Promise<SessionTokens> {
  const refreshToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

  await refreshTokenRepository.storeRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    familyId,
    expiresAt,
  });

  return {
    accessToken: signAccessToken(user),
    refreshToken,
    expiresIn: env.JWT_ACCESS_TOKEN_TTL_SECONDS,
  };
}

export async function register(params: {
  name: string;
  email: string;
  password: string;
  timezone?: string;
}): Promise<{ user: UserRecord; tokens: SessionTokens }> {
  const existing = await userRepository.findUserByEmail(params.email);
  if (existing) {
    throw new AppError(409, ErrorCodes.EMAIL_IN_USE, 'Este e-mail já está cadastrado.');
  }

  const timezone =
    params.timezone && isValidTimezone(params.timezone) ? params.timezone : DEFAULT_TIMEZONE;

  const user = await userRepository.createUser({
    name: params.name,
    email: params.email,
    passwordHash: await hashPassword(params.password),
    timezone,
  });

  return { user, tokens: await issueSession(user) };
}

export async function login(params: {
  email: string;
  password: string;
}): Promise<{ user: UserRecord; tokens: SessionTokens }> {
  const user = await userRepository.findUserByEmail(params.email);

  // Always run a bcrypt comparison, even for an unknown e-mail, so response
  // timing does not reveal whether the account exists.
  const passwordHash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const matches = await bcrypt.compare(params.password, passwordHash);

  if (!user || !matches) {
    throw new AppError(401, ErrorCodes.INVALID_CREDENTIALS, 'E-mail ou senha incorretos.');
  }

  return { user, tokens: await issueSession(user) };
}

/**
 * Rotating refresh.
 *
 * The presented token is consumed and replaced. If a token that was already
 * rotated (or explicitly revoked) shows up, it has leaked — the whole family is
 * burned, forcing a fresh sign-in on every device in that chain.
 */
export async function refreshSession(
  refreshToken: string,
): Promise<{ user: UserRecord; tokens: SessionTokens }> {
  const stored = await refreshTokenRepository.findRefreshTokenByHash(hashToken(refreshToken));
  if (!stored) throw unauthorized();

  if (stored.revokedAt) {
    await refreshTokenRepository.revokeRefreshTokenFamily(stored.familyId);
    throw unauthorized();
  }

  if (stored.expiresAt.getTime() <= Date.now()) {
    await refreshTokenRepository.revokeRefreshToken(stored.id);
    throw unauthorized();
  }

  const user = await userRepository.findUserById(stored.userId);
  if (!user) throw unauthorized();

  await refreshTokenRepository.revokeRefreshToken(stored.id);
  return { user, tokens: await issueSession(user, stored.familyId) };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  const stored = await refreshTokenRepository.findRefreshTokenByHash(hashToken(refreshToken));
  if (stored) await refreshTokenRepository.revokeRefreshTokenFamily(stored.familyId);
}

export async function changePassword(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const user = await userRepository.findUserById(params.userId);
  if (!user) throw unauthorized();

  const matches = await bcrypt.compare(params.currentPassword, user.passwordHash);
  if (!matches) {
    throw new AppError(400, ErrorCodes.INVALID_CREDENTIALS, 'Senha atual incorreta.');
  }

  await userRepository.updateUserPassword(params.userId, await hashPassword(params.newPassword));
  // Changing a password invalidates every existing session.
  await refreshTokenRepository.revokeAllUserRefreshTokens(params.userId);
}
