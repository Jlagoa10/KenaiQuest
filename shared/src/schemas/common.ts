import { z } from 'zod';
import { isIsoDate } from '../domain/dates.js';

export const uuidSchema = z.string().uuid('Identificador inválido.');

export const isoDateSchema = z
  .string()
  .refine((value) => isIsoDate(value), { message: 'Data inválida. Use o formato AAAA-MM-DD.' });

/**
 * Validated against the runtime's own IANA database so we never persist a
 * timezone that Intl cannot resolve later.
 */
export const timezoneSchema = z.string().refine(
  (value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Fuso horário inválido.' },
);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
