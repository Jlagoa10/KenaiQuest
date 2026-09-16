import { z } from 'zod';
import {
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../constants/users.js';
import { timezoneSchema } from './common.js';

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Informe o seu e-mail.')
  .max(254, 'E-mail muito longo.')
  .email('E-mail inválido.')
  .toLowerCase();

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(PASSWORD_MAX_LENGTH, 'Senha muito longa.')
  .refine((value) => /[a-zA-Z]/.test(value) && /[0-9]/.test(value), {
    message: 'A senha deve conter pelo menos uma letra e um número.',
  });

export const nameSchema = z
  .string()
  .trim()
  .min(NAME_MIN_LENGTH, 'Informe o seu nome.')
  .max(NAME_MAX_LENGTH, 'Nome muito longo.');

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  timezone: timezoneSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a sua senha.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
