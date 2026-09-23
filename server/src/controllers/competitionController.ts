import type { Request, Response } from 'express';
import type { CreateCompetitionInput, JoinCompetitionInput } from '@kenai/shared';
import { inviteCodeSchema } from '@kenai/shared';
import { requireUser } from '../middleware/authenticate.js';
import * as competitionService from '../services/competitionService.js';
import { notFound } from '../utils/errors.js';

export async function listCompetitions(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const competitions = await competitionService.listCompetitions({ user });
  res.json({ competitions });
}

export async function createCompetition(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const input = req.body as CreateCompetitionInput;
  const competition = await competitionService.createCompetition({
    user,
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
  });
  res.status(201).json({ competition });
}

export async function getCompetition(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const competition = await competitionService.getCompetitionDetail({
    user,
    competitionId: req.params.id as string,
  });
  res.json({ competition });
}

export async function previewInvite(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const parsed = inviteCodeSchema.safeParse(req.params.code);
  // A malformed code is indistinguishable from an unknown one on purpose.
  if (!parsed.success) throw notFound('Convite não encontrado. Confira o código.');
  const invite = await competitionService.previewInvite({ user, code: parsed.data });
  res.json({ invite });
}

export async function joinCompetition(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const input = req.body as JoinCompetitionInput;
  const competition = await competitionService.joinCompetition({ user, code: input.code });
  res.status(201).json({ competition });
}
