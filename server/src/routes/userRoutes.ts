import { Router } from 'express';
import { changePasswordSchema, updateProfileSchema } from '@kenai/shared';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import * as userController from '../controllers/userController.js';

export const userRoutes = Router();

userRoutes.use(asyncHandler(authenticate));

userRoutes.patch(
  '/me',
  validate(updateProfileSchema),
  asyncHandler(userController.updateProfile),
);

userRoutes.post(
  '/me/password',
  validate(changePasswordSchema),
  asyncHandler(userController.changePassword),
);
