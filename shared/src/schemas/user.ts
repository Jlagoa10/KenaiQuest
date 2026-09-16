import { z } from 'zod';
import { THEME_PREFERENCES, USER_ROLES } from '../constants/users.js';
import { nameSchema } from './auth.js';
import { timezoneSchema } from './common.js';

export const updateProfileSchema = z
  .object({
    name: nameSchema.optional(),
    timezone: timezoneSchema.optional(),
    themePreference: z.enum(THEME_PREFERENCES).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Nenhuma alteração foi enviada.',
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.'),
  newPassword: z
    .string()
    .min(8, 'A nova senha deve ter no mínimo 8 caracteres.')
    .max(128, 'Senha muito longa.')
    .refine((value) => /[a-zA-Z]/.test(value) && /[0-9]/.test(value), {
      message: 'A senha deve conter pelo menos uma letra e um número.',
    }),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(USER_ROLES),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
