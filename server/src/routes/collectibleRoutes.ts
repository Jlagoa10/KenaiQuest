import { Router } from 'express';
import { listCollectiblesSchema, setTradeListingSchema } from '@kenai/shared';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import * as collectibleController from '../controllers/collectibleController.js';

export const collectibleRoutes = Router();

collectibleRoutes.use(asyncHandler(authenticate));

collectibleRoutes.get(
  '/',
  validate(listCollectiblesSchema, 'query'),
  asyncHandler(collectibleController.listCollection),
);

collectibleRoutes.get('/:id', asyncHandler(collectibleController.getCollectible));
collectibleRoutes.get('/:id/image.png', asyncHandler(collectibleController.getCollectibleImage));

collectibleRoutes.patch(
  '/:id/listing',
  validate(setTradeListingSchema),
  asyncHandler(collectibleController.setListing),
);
