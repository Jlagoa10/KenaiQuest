import type { Request, Response } from 'express';
import type { UpdateUserRoleInput } from '@kenai/shared';
import { requireUser } from '../../middleware/authenticate.js';
import * as adminService from '../../services/adminService.js';

export async function listUsers(req: Request, res: Response): Promise<void> {
  const page = Number.parseInt(String(req.query.page ?? '1'), 10) || 1;
  const pageSize = Math.min(Number.parseInt(String(req.query.pageSize ?? '25'), 10) || 25, 100);
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;

  const result = await adminService.listUsers({ page, pageSize, ...(search ? { search } : {}) });

  res.json({
    users: result.items,
    page,
    pageSize,
    total: result.total,
    totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
  });
}

export async function updateUserRole(req: Request, res: Response): Promise<void> {
  const admin = requireUser(req);
  const { role } = req.body as UpdateUserRoleInput;

  const user = await adminService.changeUserRole({
    actingAdminId: admin.id,
    userId: req.params.id as string,
    role,
  });

  res.json({ user });
}

export async function getStats(_req: Request, res: Response): Promise<void> {
  res.json({ stats: await adminService.getStats() });
}
