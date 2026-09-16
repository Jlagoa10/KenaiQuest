import { z } from 'zod';
import { MAX_GOAL_DURATION_DAYS, MIN_GOAL_DURATION_DAYS } from '../constants/goals.js';
import { RARITIES } from '../constants/rarity.js';

/**
 * Weights are relative, not percentages: the engine normalises them against
 * their own total. The admin UI states this explicitly so "65 / 30 / 5" and
 * "13 / 6 / 1" behave identically.
 */
export const rewardRuleWeightSchema = z.object({
  rarity: z.enum(RARITIES),
  weight: z.coerce
    .number()
    .min(0, 'O peso não pode ser negativo.')
    .max(1_000_000, 'Peso muito alto.'),
});

const baseRewardRuleSchema = z.object({
  name: z.string().trim().min(2, 'Informe um nome para a regra.').max(80, 'Nome muito longo.'),
  minDays: z.coerce.number().int().min(MIN_GOAL_DURATION_DAYS).max(MAX_GOAL_DURATION_DAYS),
  maxDays: z.coerce.number().int().min(MIN_GOAL_DURATION_DAYS).max(MAX_GOAL_DURATION_DAYS),
  priority: z.coerce.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
  weights: z
    .array(rewardRuleWeightSchema)
    .min(1, 'Defina pelo menos uma raridade.')
    .refine(
      (weights) => new Set(weights.map((weight) => weight.rarity)).size === weights.length,
      { message: 'Cada raridade só pode aparecer uma vez.' },
    )
    .refine((weights) => weights.some((weight) => weight.weight > 0), {
      message: 'Pelo menos uma raridade precisa ter peso maior que zero.',
    }),
});

export const createRewardRuleSchema = baseRewardRuleSchema.refine(
  (rule) => rule.minDays <= rule.maxDays,
  { message: 'O dia inicial deve ser menor ou igual ao dia final.', path: ['maxDays'] },
);

export const updateRewardRuleSchema = baseRewardRuleSchema
  .partial()
  .refine((rule) => Object.values(rule).some((field) => field !== undefined), {
    message: 'Nenhuma alteração foi enviada.',
  })
  .refine(
    (rule) => rule.minDays === undefined || rule.maxDays === undefined || rule.minDays <= rule.maxDays,
    { message: 'O dia inicial deve ser menor ou igual ao dia final.', path: ['maxDays'] },
  );

export type CreateRewardRuleInput = z.infer<typeof createRewardRuleSchema>;
export type UpdateRewardRuleInput = z.infer<typeof updateRewardRuleSchema>;
export type RewardRuleWeightInput = z.infer<typeof rewardRuleWeightSchema>;
