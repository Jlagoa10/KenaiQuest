import type { Request, Response } from 'express';
import type { ListCollectiblesInput, Rarity } from '@kenai/shared';
import { requireUser } from '../middleware/authenticate.js';
import { validatedQuery } from '../middleware/validate.js';
import * as collectibleService from '../services/collectibleService.js';
import { compositeRevealedImage } from '../services/imageCompositor.js';
import type { CollectibleFilters } from '../repositories/collectibleRepository.js';

function toFilters(query: ListCollectiblesInput | undefined): CollectibleFilters {
  if (!query) return {};
  const filters: CollectibleFilters = {};
  if (query.rarity) filters.rarity = query.rarity as Rarity;
  if (query.perfectOnly === 'true') filters.perfectOnly = true;
  if (query.tradableOnly === 'true') filters.tradableOnly = true;
  if (query.listedOnly === 'true') filters.listedOnly = true;
  if (query.minCompletion !== undefined) filters.minCompletion = query.minCompletion;
  if (query.search) filters.search = query.search;
  return filters;
}

export async function listCollection(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const filters = toFilters(validatedQuery<ListCollectiblesInput>(req));
  const collectibles = await collectibleService.listMyCollection({ user, filters });
  res.json({ collectibles });
}

export async function getCollectible(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const collectible = await collectibleService.getCollectibleDetail({
    user,
    collectibleId: req.params.id as string,
  });
  res.json({ collectible });
}

export async function setListing(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { listed } = req.body as { listed: boolean };
  const collectible = await collectibleService.setListing({
    user,
    collectibleId: req.params.id as string,
    listed,
  });
  res.json({ collectible });
}

/**
 * A collectible's pieces are frozen at minting, so its render never changes.
 * That makes it safe to cache immutably once fetched.
 */
export async function getCollectibleImage(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { collectible, artwork, imageVersion } = await collectibleService.getCollectibleForImage({
    user,
    collectibleId: req.params.id as string,
  });

  const etag = `"${imageVersion}"`;
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }

  const png = await compositeRevealedImage({
    artwork,
    totalPieces: collectible.totalPieces,
    revealedPieceIndexes: collectible.ownedPieceIndexes,
    version: imageVersion,
  });

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
  res.send(png);
}

export async function listAvailableForTrade(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const filters = toFilters(validatedQuery<ListCollectiblesInput>(req));
  const collectibles = await collectibleService.listAvailableForTrade({ user, filters });
  res.json({ collectibles });
}
