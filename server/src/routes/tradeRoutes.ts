import { Router } from 'express';
import { createTradeOfferSchema, listCollectiblesSchema } from '@kenai/shared';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import * as tradeController from '../controllers/tradeController.js';
import * as collectibleController from '../controllers/collectibleController.js';

export const tradeRoutes = Router();

tradeRoutes.use(asyncHandler(authenticate));

tradeRoutes.get(
  '/available',
  validate(listCollectiblesSchema, 'query'),
  asyncHandler(collectibleController.listAvailableForTrade),
);

tradeRoutes.get('/offers/sent', asyncHandler(tradeController.listSent));
tradeRoutes.get('/offers/received', asyncHandler(tradeController.listReceived));
tradeRoutes.get('/offers/history', asyncHandler(tradeController.listHistory));

tradeRoutes.post(
  '/offers',
  validate(createTradeOfferSchema),
  asyncHandler(tradeController.createOffer),
);

tradeRoutes.post('/offers/:id/accept', asyncHandler(tradeController.acceptOffer));
tradeRoutes.post('/offers/:id/reject', asyncHandler(tradeController.rejectOffer));
tradeRoutes.post('/offers/:id/cancel', asyncHandler(tradeController.cancelOffer));
