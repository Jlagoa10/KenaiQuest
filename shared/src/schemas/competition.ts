import { z } from 'zod';
import {
  COMPETITION_NAME_MAX_LENGTH,
  COMPETITION_NAME_MIN_LENGTH,
  INVITE_CODE_PATTERN,
  MAX_COMPETITION_DURATION_DAYS,
  MIN_COMPETITION_DURATION_DAYS,
} from '../constants/competitions.js';
import { competitionDurationDays } from '../domain/competition.js';
import { compareIsoDates, isIsoDate } from '../domain/dates.js';
import { isoDateSchema } from './common.js';

export const createCompetitionSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(COMPETITION_NAME_MIN_LENGTH, 'Dê um nome para a competição.')
      .max(COMPETITION_NAME_MAX_LENGTH, 'Nome muito longo.'),
    /** Must be after today in the creator's timezone — checked on the server. */
    startDate: isoDateSchema,
    endDate: isoDateSchema,
  })
  .superRefine((value, context) => {
    // Each date already reports its own format error; only compare valid ones.
    if (!isIsoDate(value.startDate) || !isIsoDate(value.endDate)) return;
    if (compareIsoDates(value.endDate, value.startDate) < 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'A data de término deve ser depois da data de início.',
      });
      return;
    }
    const duration = competitionDurationDays(value.startDate, value.endDate);
    if (duration < MIN_COMPETITION_DURATION_DAYS || duration > MAX_COMPETITION_DURATION_DAYS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: `A competição deve durar entre ${MIN_COMPETITION_DURATION_DAYS} e ${MAX_COMPETITION_DURATION_DAYS} dias.`,
      });
    }
  });

/** Accepts lowercase and surrounding spaces, since codes are often typed by hand. */
export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(INVITE_CODE_PATTERN, 'Código de convite inválido.');

export const joinCompetitionSchema = z.object({
  code: inviteCodeSchema,
});

export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>;
export type JoinCompetitionInput = z.infer<typeof joinCompetitionSchema>;
