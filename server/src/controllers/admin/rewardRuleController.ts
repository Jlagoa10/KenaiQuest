import type { Request, Response } from 'express';
import type { CreateRewardRuleInput, UpdateRewardRuleInput } from '@kenai/shared';
import * as rewardRuleService from '../../services/rewardRuleService.js';
import { describeChancesForDuration } from '../../services/rewardEngine.js';

export async function listRules(_req: Request, res: Response): Promise<void> {
  res.json({ rules: await rewardRuleService.listRewardRules() });
}

export async function createRule(req: Request, res: Response): Promise<void> {
  const rule = await rewardRuleService.createRewardRule(req.body as CreateRewardRuleInput);
  res.status(201).json({ rule });
}

export async function updateRule(req: Request, res: Response): Promise<void> {
  const rule = await rewardRuleService.updateRewardRule(
    req.params.id as string,
    req.body as UpdateRewardRuleInput,
  );
  res.json({ rule });
}

export async function deleteRule(req: Request, res: Response): Promise<void> {
  await rewardRuleService.deleteRewardRule(req.params.id as string);
  res.status(204).send();
}

/** Lets an admin see exactly what a given duration would draw right now. */
export async function previewChances(req: Request, res: Response): Promise<void> {
  const duration = Number.parseInt(String(req.query.durationDays ?? ''), 10);
  if (!Number.isInteger(duration) || duration < 7 || duration > 365) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Informe uma duração entre 7 e 365 dias.' },
    });
    return;
  }

  res.json(await describeChancesForDuration(duration));
}
