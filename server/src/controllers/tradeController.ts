import type { Request, Response } from 'express';
import type { CreateTradeOfferInput } from '@kenai/shared';
import { requireUser } from '../middleware/authenticate.js';
import * as tradeService from '../services/tradeService.js';

export async function createOffer(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const input = req.body as CreateTradeOfferInput;

  const offer = await tradeService.createOffer({
    user,
    offeredCollectibleId: input.offeredCollectibleId,
    requestedCollectibleId: input.requestedCollectibleId,
    message: input.message,
  });

  res.status(201).json({ offer });
}

export async function listSent(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  res.json({ offers: await tradeService.listOffers({ user, direction: 'sent' }) });
}

export async function listReceived(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  res.json({ offers: await tradeService.listOffers({ user, direction: 'received' }) });
}

export async function listHistory(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  res.json({ offers: await tradeService.listOffers({ user, direction: 'history' }) });
}

export async function acceptOffer(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const offer = await tradeService.acceptOffer({ user, offerId: req.params.id as string });
  res.json({ offer });
}

export async function rejectOffer(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const offer = await tradeService.rejectOffer({ user, offerId: req.params.id as string });
  res.json({ offer });
}

export async function cancelOffer(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const offer = await tradeService.cancelOffer({ user, offerId: req.params.id as string });
  res.json({ offer });
}
