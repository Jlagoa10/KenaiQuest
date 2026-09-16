import { z } from 'zod';
import {
  COMPLETION_TARGETS,
  GOAL_DESCRIPTION_MAX_LENGTH,
  GOAL_TITLE_MAX_LENGTH,
  GOAL_TITLE_MIN_LENGTH,
  MAX_GOAL_DURATION_DAYS,
  MIN_GOAL_DURATION_DAYS,
} from '../constants/goals.js';
import { isoDateSchema } from './common.js';

export const createGoalSchema = z.object({
  title: z
    .string()
    .trim()
    .min(GOAL_TITLE_MIN_LENGTH, 'Dê um nome para a sua meta.')
    .max(GOAL_TITLE_MAX_LENGTH, 'Nome muito longo.'),
  description: z
    .string()
    .trim()
    .max(GOAL_DESCRIPTION_MAX_LENGTH, 'Descrição muito longa.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  durationDays: z.coerce
    .number()
    .int('A duração deve ser um número inteiro de dias.')
    .min(MIN_GOAL_DURATION_DAYS, `A meta deve ter no mínimo ${MIN_GOAL_DURATION_DAYS} dias.`)
    .max(MAX_GOAL_DURATION_DAYS, `A meta deve ter no máximo ${MAX_GOAL_DURATION_DAYS} dias.`),
  /** Must be today or later, evaluated against the user's own timezone on the server. */
  startDate: isoDateSchema,
});

export const completeGoalDaySchema = z.object({
  target: z.enum(COMPLETION_TARGETS, {
    errorMap: () => ({ message: 'Escolha entre Hoje e Ontem.' }),
  }),
});

export const deleteGoalSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'Confirme que deseja perder a recompensa misteriosa.' }),
  }),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type CompleteGoalDayInput = z.infer<typeof completeGoalDaySchema>;
