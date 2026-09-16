import type { Request, Response } from 'express';
import type { CompleteGoalDayInput, CreateGoalInput, GoalStatus } from '@kenai/shared';
import { requireUser } from '../middleware/authenticate.js';
import * as goalService from '../services/goalService.js';
import * as artworkRepository from '../repositories/artworkRepository.js';
import { compositeRevealedImage } from '../services/imageCompositor.js';
import { notFound } from '../utils/errors.js';

export async function createGoal(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const input = req.body as CreateGoalInput;

  const goal = await goalService.createGoal({
    user,
    title: input.title,
    description: input.description,
    durationDays: input.durationDays,
    startDate: input.startDate,
  });

  res.status(201).json({ goal });
}

export async function listGoals(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const status = req.query.status as GoalStatus | undefined;

  const goals = await goalService.listGoals({
    user,
    status: status && ['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status) ? status : undefined,
  });

  res.json({ goals });
}

export async function getGoal(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const goal = await goalService.getGoalDetail({ user, goalId: req.params.id as string });
  res.json({ goal });
}

export async function completeDay(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const input = req.body as CompleteGoalDayInput;

  const result = await goalService.completeGoalDay({
    user,
    goalId: req.params.id as string,
    target: input.target,
  });

  res.json(result);
}

export async function cancelGoal(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  await goalService.cancelGoal({ user, goalId: req.params.id as string });
  res.status(204).send();
}

/**
 * Streams the partially revealed artwork.
 *
 * The response contains ONLY the regions the user has unlocked, composited on
 * the server. Locked pixels are never transmitted, so the mystery survives
 * devtools. The ETag lets the browser skip the transfer entirely once a version
 * has been seen.
 */
export async function getGoalImage(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { goal, revealedPieceIndexes, imageVersion } = await goalService.getGoalForImage({
    user,
    goalId: req.params.id as string,
  });

  const artwork = await artworkRepository.findArtworkById(goal.artworkId);
  if (!artwork) throw notFound('Arte não encontrada.');

  const etag = `"${imageVersion}"`;
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }

  const png = await compositeRevealedImage({
    artwork,
    totalPieces: goal.totalPieces,
    revealedPieceIndexes,
    version: imageVersion,
  });

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('ETag', etag);
  // Private: this render belongs to one user's goal and must not be shared by
  // any intermediary cache.
  res.setHeader('Cache-Control', 'private, max-age=60, must-revalidate');
  res.send(png);
}
