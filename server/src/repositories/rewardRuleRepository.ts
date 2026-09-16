import type { Rarity } from '@kenai/shared';
import { pool } from '../database/pool.js';
import type { Queryable } from '../database/types.js';
import type { RewardRuleRecord, RewardRuleWeightRecord } from '../types/models.js';
import { mapRewardRule } from './mappers.js';

export interface RewardRuleWithWeights extends RewardRuleRecord {
  weights: RewardRuleWeightRecord[];
}

const SELECT_COLUMNS = `id, name, min_days, max_days, priority, is_active, created_at, updated_at`;

/**
 * The active rule whose range contains `durationDays`.
 * Overlapping ranges are resolved by priority (highest wins), which is what lets
 * an admin drop a narrow override on top of a broad rule without editing it.
 */
export async function findRuleForDuration(
  durationDays: number,
  db: Queryable = pool,
): Promise<RewardRuleWithWeights | null> {
  const result = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM reward_rules
     WHERE is_active AND $1 BETWEEN min_days AND max_days
     ORDER BY priority DESC, (max_days - min_days) ASC, created_at ASC
     LIMIT 1`,
    [durationDays],
  );
  const row = result.rows[0];
  if (!row) return null;

  const rule = mapRewardRule(row);
  return { ...rule, weights: await findWeightsForRule(rule.id, db) };
}

export async function findWeightsForRule(
  ruleId: string,
  db: Queryable = pool,
): Promise<RewardRuleWeightRecord[]> {
  const result = await db.query(
    `SELECT rarity, weight FROM reward_rule_weights WHERE rule_id = $1 ORDER BY rarity`,
    [ruleId],
  );
  return result.rows.map((row) => ({ rarity: row.rarity as Rarity, weight: Number(row.weight) }));
}

export async function listRewardRules(db: Queryable = pool): Promise<RewardRuleWithWeights[]> {
  const result = await db.query(
    `SELECT r.${SELECT_COLUMNS.split(', ').join(', r.')},
            COALESCE(
              json_agg(json_build_object('rarity', w.rarity, 'weight', w.weight)
                       ORDER BY w.rarity) FILTER (WHERE w.id IS NOT NULL),
              '[]'
            ) AS weights
     FROM reward_rules r
     LEFT JOIN reward_rule_weights w ON w.rule_id = r.id
     GROUP BY r.id
     ORDER BY r.min_days ASC, r.priority DESC`,
  );

  return result.rows.map((row) => ({
    ...mapRewardRule(row),
    weights: (row.weights as Array<{ rarity: Rarity; weight: string | number }>).map((weight) => ({
      rarity: weight.rarity,
      weight: Number(weight.weight),
    })),
  }));
}

export async function findRewardRuleById(
  id: string,
  db: Queryable = pool,
): Promise<RewardRuleWithWeights | null> {
  const result = await db.query(`SELECT ${SELECT_COLUMNS} FROM reward_rules WHERE id = $1`, [id]);
  const row = result.rows[0];
  if (!row) return null;
  const rule = mapRewardRule(row);
  return { ...rule, weights: await findWeightsForRule(rule.id, db) };
}

export async function createRewardRule(
  params: {
    name: string;
    minDays: number;
    maxDays: number;
    priority: number;
    isActive: boolean;
    weights: Array<{ rarity: Rarity; weight: number }>;
  },
  db: Queryable = pool,
): Promise<RewardRuleWithWeights> {
  const result = await db.query(
    `INSERT INTO reward_rules (name, min_days, max_days, priority, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SELECT_COLUMNS}`,
    [params.name, params.minDays, params.maxDays, params.priority, params.isActive],
  );
  const rule = mapRewardRule(result.rows[0]);
  await replaceRuleWeights(rule.id, params.weights, db);
  return { ...rule, weights: await findWeightsForRule(rule.id, db) };
}

export async function updateRewardRule(
  id: string,
  params: {
    name?: string;
    minDays?: number;
    maxDays?: number;
    priority?: number;
    isActive?: boolean;
  },
  db: Queryable = pool,
): Promise<RewardRuleRecord | null> {
  const result = await db.query(
    `UPDATE reward_rules SET
       name      = COALESCE($2, name),
       min_days  = COALESCE($3::int, min_days),
       max_days  = COALESCE($4::int, max_days),
       priority  = COALESCE($5::int, priority),
       is_active = COALESCE($6::boolean, is_active)
     WHERE id = $1
     RETURNING ${SELECT_COLUMNS}`,
    [
      id,
      params.name ?? null,
      params.minDays ?? null,
      params.maxDays ?? null,
      params.priority ?? null,
      params.isActive ?? null,
    ],
  );
  return result.rows[0] ? mapRewardRule(result.rows[0]) : null;
}

export async function replaceRuleWeights(
  ruleId: string,
  weights: Array<{ rarity: Rarity; weight: number }>,
  db: Queryable = pool,
): Promise<void> {
  await db.query('DELETE FROM reward_rule_weights WHERE rule_id = $1', [ruleId]);
  if (weights.length === 0) return;

  // Single round trip via UNNEST rather than a loop of INSERTs.
  await db.query(
    `INSERT INTO reward_rule_weights (rule_id, rarity, weight)
     SELECT $1, rarity::rarity, weight
     FROM unnest($2::text[], $3::numeric[]) AS t(rarity, weight)`,
    [ruleId, weights.map((w) => w.rarity), weights.map((w) => w.weight)],
  );
}

export async function deleteRewardRule(id: string, db: Queryable = pool): Promise<boolean> {
  const result = await db.query('DELETE FROM reward_rules WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
