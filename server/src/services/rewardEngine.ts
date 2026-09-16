import type { Rarity } from '@kenai/shared';
import { RARITIES, pickOne, weightedPick, type RandomSource } from '@kenai/shared';
import type { Queryable } from '../database/types.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import * as artworkRepository from '../repositories/artworkRepository.js';
import * as rewardRuleRepository from '../repositories/rewardRuleRepository.js';
import type { ArtworkRecord } from '../types/models.js';

/**
 * Reward engine.
 *
 *   goal duration -> matching rule -> rarity weights -> rarity -> artwork
 *
 * Every step reads configuration from the database, so an admin retunes drop
 * rates or adds artwork without a deployment. The engine never selects from the
 * whole catalogue at random, and it never crashes on an unstocked pool: empty
 * rarities are removed BEFORE the draw, so the weights the user actually
 * experiences always refer to artwork that exists.
 */

export interface RewardSelection {
  artwork: ArtworkRecord;
  rarity: Rarity;
  ruleId: string | null;
}

export interface RarityChance {
  rarity: Rarity;
  weight: number;
  activeArtworks: number;
  normalisedPercent: number;
}

/**
 * What a goal of this duration can currently draw, after empty pools are
 * removed. Powers the admin preview and is the single place the normalisation
 * rule is implemented.
 */
export async function describeChancesForDuration(
  durationDays: number,
  db?: Queryable,
): Promise<{ ruleName: string | null; chances: RarityChance[] }> {
  const rule = await rewardRuleRepository.findRuleForDuration(durationDays, db);
  const counts = await artworkRepository.countActiveArtworksByRarity(db);

  if (!rule) return { ruleName: null, chances: [] };

  const selectable = rule.weights
    .map((weight) => ({
      rarity: weight.rarity,
      weight: weight.weight,
      activeArtworks: counts[weight.rarity] ?? 0,
    }))
    .filter((entry) => entry.weight > 0 && entry.activeArtworks > 0);

  const total = selectable.reduce((sum, entry) => sum + entry.weight, 0);

  return {
    ruleName: rule.name,
    chances: rule.weights.map((weight) => {
      const active = counts[weight.rarity] ?? 0;
      const eligible = weight.weight > 0 && active > 0;
      return {
        rarity: weight.rarity,
        weight: weight.weight,
        activeArtworks: active,
        normalisedPercent:
          eligible && total > 0 ? Math.round((weight.weight / total) * 10000) / 100 : 0,
      };
    }),
  };
}

/**
 * Picks the secret reward for a new goal.
 *
 * `random` is injectable so tests can assert exact outcomes instead of
 * sampling. Runs inside the goal-creation transaction, so the artwork it
 * returns is guaranteed to still exist when the goal row is written.
 */
export async function selectReward(
  params: { durationDays: number; random?: RandomSource },
  db?: Queryable,
): Promise<RewardSelection> {
  const { durationDays, random } = params;

  const rule = await rewardRuleRepository.findRuleForDuration(durationDays, db);
  const counts = await artworkRepository.countActiveArtworksByRarity(db);

  // A rarity is only selectable when it has weight AND at least one active
  // artwork, which is what keeps a partially stocked catalogue working.
  const candidates = (rule?.weights ?? [])
    .filter((weight) => weight.weight > 0 && (counts[weight.rarity] ?? 0) > 0)
    .map((weight) => ({ value: weight.rarity, weight: weight.weight }));

  let rarity = weightedPick(candidates, random);

  if (!rarity) {
    // No configured rarity is stocked. Rather than fail the user's goal, fall
    // back to any rarity that does have active artwork, lowest value first.
    const fallback = RARITIES.find((candidate) => (counts[candidate] ?? 0) > 0);
    if (fallback) {
      logger.warn(
        { durationDays, ruleId: rule?.id ?? null },
        'Nenhuma raridade configurada possui arte ativa; usando fallback.',
      );
      rarity = fallback;
    }
  }

  if (!rarity) {
    throw new AppError(
      503,
      ErrorCodes.NO_ARTWORK_AVAILABLE,
      'Nenhuma arte do Kenai está disponível no momento. Tente novamente mais tarde.',
    );
  }

  const pool = await artworkRepository.findActiveArtworksByRarity(rarity, db);
  const artwork = pickOne(pool, random);

  if (!artwork) {
    throw new AppError(
      503,
      ErrorCodes.NO_ARTWORK_AVAILABLE,
      'Nenhuma arte do Kenai está disponível no momento. Tente novamente mais tarde.',
    );
  }

  return { artwork, rarity, ruleId: rule?.id ?? null };
}
