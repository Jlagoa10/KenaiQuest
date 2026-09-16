import { Router } from 'express';
import { completeGoalDaySchema, createGoalSchema } from '@kenai/shared';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import * as goalController from '../controllers/goalController.js';

export const goalRoutes = Router();

goalRoutes.use(asyncHandler(authenticate));

goalRoutes.get('/', asyncHandler(goalController.listGoals));
goalRoutes.post('/', validate(createGoalSchema), asyncHandler(goalController.createGoal));
goalRoutes.get('/:id', asyncHandler(goalController.getGoal));
goalRoutes.get('/:id/image.png', asyncHandler(goalController.getGoalImage));
goalRoutes.post(
  '/:id/complete',
  validate(completeGoalDaySchema),
  asyncHandler(goalController.completeDay),
);
goalRoutes.delete('/:id', asyncHandler(goalController.cancelGoal));
