import type {
  CreateRewardRuleInput,
  RewardRuleDto,
  RewardRuleWeightDto,
  UpdateRewardRuleInput,
} from '@kenai/shared';
import { RARITIES } from '@kenai/shared';
import { withTransaction } from '../database/transaction.js';
import { AppError, notFound } from '../utils/errors.js';
import * as rewardRuleRepository from '../repositories/rewardRuleRepository.js';
import * as artworkRepository from '../repositories/artworkRepository.js';
import type { RewardRuleWithWeights } from '../repositories/rewardRuleRepository.js';

/**
 * Presents a rule with its weights already normalised into percentages, and
 * annotated with how many active artworks back each rarity. That is what lets
 * the admin UI explain, honestly, that "65 / 30 / 5" and "13 / 6 / 1" behave
 * identically, and warn when a configured rarity has no artwork to draw from.
 */
function toRewardRuleDto(
  rule: RewardRuleWithWeights,
  artworkCounts: Record<string, number>,
): RewardRuleDto {
  const selectableTotal = rule.weights
    .filter((weight) => weight.weight > 0 && (artworkCounts[weight.rarity] ?? 0) > 0)
    .reduce((sum, weight) => sum + weight.weight, 0);

  const weights: RewardRuleWeightDto[] = rule.weights.map((weight) => {
    const activeArtworks = artworkCounts[weight.rarity] ?? 0;
    const selectable = weight.weight > 0 && activeArtworks > 0;
    return {
      rarity: weight.rarity,
      weight: weight.weight,
      normalisedPercent:
        selectable && selectableTotal > 0
          ? Math.round((weight.weight / selectableTotal) * 10000) / 100
          : 0,
      activeArtworks,
    };
  });

  return {
    id: rule.id,
    name: rule.name,
    minDays: rule.minDays,
    maxDays: rule.maxDays,
    priority: rule.priority,
    isActive: rule.isActive,
    weights: weights.sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity)),
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export async function listRewardRules(): Promise<RewardRuleDto[]> {
  const [rules, counts] = await Promise.all([
    rewardRuleRepository.listRewardRules(),
    artworkRepository.countActiveArtworksByRarity(),
  ]);
  return rules.map((rule) => toRewardRuleDto(rule, counts));
}

export async function createRewardRule(input: CreateRewardRuleInput): Promise<RewardRuleDto> {
  const rule = await rewardRuleRepository.createRewardRule({
    name: input.name,
    minDays: input.minDays,
    maxDays: input.maxDays,
    priority: input.priority,
    isActive: input.isActive,
    weights: input.weights,
  });
  const counts = await artworkRepository.countActiveArtworksByRarity();
  return toRewardRuleDto(rule, counts);
}

export async function updateRewardRule(
  id: string,
  input: UpdateRewardRuleInput,
): Promise<RewardRuleDto> {
  const existing = await rewardRuleRepository.findRewardRuleById(id);
  if (!existing) throw notFound('Regra não encontrada.');

  const minDays = input.minDays ?? existing.minDays;
  const maxDays = input.maxDays ?? existing.maxDays;
  if (minDays > maxDays) {
    throw new AppError(
      422,
      'VALIDATION_ERROR',
      'O dia inicial deve ser menor ou igual ao dia final.',
    );
  }

  const updated = await withTransaction(async (client) => {
    const rule = await rewardRuleRepository.updateRewardRule(
      id,
      {
        name: input.name,
        minDays: input.minDays,
        maxDays: input.maxDays,
        priority: input.priority,
        isActive: input.isActive,
      },
      client,
    );
    if (!rule) throw notFound('Regra não encontrada.');

    if (input.weights) {
      await rewardRuleRepository.replaceRuleWeights(id, input.weights, client);
    }

    const weights = await rewardRuleRepository.findWeightsForRule(id, client);
    return { ...rule, weights };
  });

  const counts = await artworkRepository.countActiveArtworksByRarity();
  return toRewardRuleDto(updated, counts);
}

export async function deleteRewardRule(id: string): Promise<void> {
  const deleted = await rewardRuleRepository.deleteRewardRule(id);
  if (!deleted) throw notFound('Regra não encontrada.');
}
