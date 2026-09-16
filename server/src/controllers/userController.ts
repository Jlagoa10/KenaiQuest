import type { Request, Response } from 'express';
import type { ChangePasswordInput, UpdateProfileInput } from '@kenai/shared';
import { requireUser } from '../middleware/authenticate.js';
import { notFound } from '../utils/errors.js';
import * as authService from '../services/authService.js';
import * as userRepository from '../repositories/userRepository.js';

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const input = req.body as UpdateProfileInput;

  const updated = await userRepository.updateUserProfile(user.id, input);
  if (!updated) throw notFound('Usuário não encontrado.');

  res.json({ user: authService.toUserDto(updated) });
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const input = req.body as ChangePasswordInput;

  await authService.changePassword({
    userId: user.id,
    currentPassword: input.currentPassword,
    newPassword: input.newPassword,
  });

  res.status(204).send();
}
