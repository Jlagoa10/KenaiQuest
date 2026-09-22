import { Router } from 'express';
import { createCompetitionSchema, joinCompetitionSchema, uuidSchema } from '@kenai/shared';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { inviteLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import * as competitionController from '../controllers/competitionController.js';

export const competitionRoutes = Router();

// Every competition route requires a signed-in user: there is no anonymous view.
competitionRoutes.use(asyncHandler(authenticate));

competitionRoutes.get('/', asyncHandler(competitionController.listCompetitions));
competitionRoutes.post(
  '/',
  validate(createCompetitionSchema),
  asyncHandler(competitionController.createCompetition),
);

// Invitation codes are the only guessable surface here, so they get their own limiter.
competitionRoutes.get(
  '/invite/:code',
  inviteLimiter,
  asyncHandler(competitionController.previewInvite),
);
competitionRoutes.post(
  '/join',
  inviteLimiter,
  validate(joinCompetitionSchema),
  asyncHandler(competitionController.joinCompetition),
);

competitionRoutes.get(
  '/:id',
  validate(z.object({ id: uuidSchema }), 'params'),
  asyncHandler(competitionController.getCompetition),
);
