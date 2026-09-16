import type { AdminStatsDto, AdminUserDto, UserRole } from '@kenai/shared';
import { pool } from '../database/pool.js';
import { AppError, ErrorCodes, notFound } from '../utils/errors.js';
import * as userRepository from '../repositories/userRepository.js';
import * as goalRepository from '../repositories/goalRepository.js';
import * as collectibleRepository from '../repositories/collectibleRepository.js';
import * as tradeRepository from '../repositories/tradeRepository.js';
import * as refreshTokenRepository from '../repositories/refreshTokenRepository.js';

export async function listUsers(params: {
  search?: string;
  page: number;
  pageSize: number;
}): Promise<{ items: AdminUserDto[]; total: number }> {
  const result = await userRepository.listUsersForAdmin(params);
  return {
    total: result.total,
    items: result.items.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      timezone: user.timezone,
      goalsCount: user.goalsCount,
      collectiblesCount: user.collectiblesCount,
      createdAt: user.createdAt.toISOString(),
    })),
  };
}

/**
 * Role changes are guarded so the instance can never be left without an
 * administrator: demoting the last ADMIN is refused, and an admin cannot demote
 * themselves by accident.
 */
export async function changeUserRole(params: {
  actingAdminId: string;
  userId: string;
  role: UserRole;
}): Promise<AdminUserDto> {
  const target = await userRepository.findUserById(params.userId);
  if (!target) throw notFound('Usuário não encontrado.');

  if (target.role === 'ADMIN' && params.role === 'USER') {
    if (params.userId === params.actingAdminId) {
      throw new AppError(
        409,
        ErrorCodes.LAST_ADMIN,
        'Você não pode remover o seu próprio acesso de administrador.',
      );
    }
    const adminCount = await userRepository.countAdmins();
    if (adminCount <= 1) {
      throw new AppError(
        409,
        ErrorCodes.LAST_ADMIN,
        'É necessário manter pelo menos um administrador.',
      );
    }
  }

  const updated = await userRepository.updateUserRole(params.userId, params.role);
  if (!updated) throw notFound('Usuário não encontrado.');

  // A role change must not leave an elevated session alive.
  await refreshTokenRepository.revokeAllUserRefreshTokens(params.userId);

  const counts = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM goals WHERE user_id = $1)        AS goals,
       (SELECT count(*)::int FROM collectibles WHERE owner_id = $1) AS collectibles`,
    [params.userId],
  );

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    timezone: updated.timezone,
    goalsCount: counts.rows[0]?.goals ?? 0,
    collectiblesCount: counts.rows[0]?.collectibles ?? 0,
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function getStats(): Promise<AdminStatsDto> {
  const [goalCounts, artworks, collectibles, trades, userCounts] = await Promise.all([
    goalRepository.countGoalsByStatus(),
    pool.query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE is_active)::int AS active
       FROM artworks`,
    ),
    collectibleRepository.countCollectibles(),
    tradeRepository.countTrades(),
    pool.query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE role = 'ADMIN')::int AS admins
       FROM users`,
    ),
  ]);

  return {
    users: userCounts.rows[0]?.total ?? 0,
    admins: userCounts.rows[0]?.admins ?? 0,
    activeGoals: goalCounts.ACTIVE,
    completedGoals: goalCounts.COMPLETED,
    artworks: artworks.rows[0]?.total ?? 0,
    activeArtworks: artworks.rows[0]?.active ?? 0,
    collectibles,
    pendingTrades: trades.pending,
    completedTrades: trades.completed,
  };
}
