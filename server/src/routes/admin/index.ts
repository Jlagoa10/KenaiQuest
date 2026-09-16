import { Router } from 'express';
import {
  createRewardRuleSchema,
  updateArtworkSchema,
  updateRewardRuleSchema,
  updateUserRoleSchema,
} from '@kenai/shared';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { authenticate, authorizeRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { artworkUpload } from '../../middleware/upload.js';
import { uploadLimiter } from '../../middleware/rateLimit.js';
import * as artworkController from '../../controllers/admin/artworkController.js';
import * as rewardRuleController from '../../controllers/admin/rewardRuleController.js';
import * as adminUserController from '../../controllers/admin/adminUserController.js';

export const adminRoutes = Router();

// Every admin route is gated twice: a valid session, then the ADMIN role.
// A normal user receives 403 from here, never a partial response.
adminRoutes.use(asyncHandler(authenticate));
adminRoutes.use(authorizeRole('ADMIN'));

adminRoutes.get('/stats', asyncHandler(adminUserController.getStats));

adminRoutes.get('/artworks', asyncHandler(artworkController.listArtworks));
adminRoutes.post('/artworks', uploadLimiter, artworkUpload, asyncHandler(artworkController.createArtwork));
adminRoutes.get('/artworks/:id/preview.png', asyncHandler(artworkController.previewArtwork));
adminRoutes.patch(
  '/artworks/:id',
  validate(updateArtworkSchema),
  asyncHandler(artworkController.updateArtwork),
);
adminRoutes.delete('/artworks/:id', asyncHandler(artworkController.deleteArtwork));

adminRoutes.get('/reward-rules', asyncHandler(rewardRuleController.listRules));
adminRoutes.get('/reward-rules/preview', asyncHandler(rewardRuleController.previewChances));
adminRoutes.post(
  '/reward-rules',
  validate(createRewardRuleSchema),
  asyncHandler(rewardRuleController.createRule),
);
adminRoutes.patch(
  '/reward-rules/:id',
  validate(updateRewardRuleSchema),
  asyncHandler(rewardRuleController.updateRule),
);
adminRoutes.delete('/reward-rules/:id', asyncHandler(rewardRuleController.deleteRule));

adminRoutes.get('/users', asyncHandler(adminUserController.listUsers));
adminRoutes.patch(
  '/users/:id/role',
  validate(updateUserRoleSchema),
  asyncHandler(adminUserController.updateUserRole),
);
