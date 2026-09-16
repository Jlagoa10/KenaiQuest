import { Router } from 'express';
import { loginSchema, registerSchema } from '@kenai/shared';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { authLimiter, refreshLimiter, registerLimiter } from '../middleware/rateLimit.js';
import * as authController from '../controllers/authController.js';

export const authRoutes = Router();

authRoutes.post(
  '/register',
  registerLimiter,
  validate(registerSchema),
  asyncHandler(authController.register),
);

authRoutes.post('/login', authLimiter, validate(loginSchema), asyncHandler(authController.login));
authRoutes.post('/refresh', refreshLimiter, asyncHandler(authController.refresh));
authRoutes.post('/logout', asyncHandler(authController.logout));
authRoutes.get('/me', asyncHandler(authenticate), asyncHandler(authController.me));
