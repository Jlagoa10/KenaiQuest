import { z } from 'zod';
import { RARITIES } from '../constants/rarity.js';
import { uuidSchema } from './common.js';

export const createTradeOfferSchema = z.object({
  /** A collectible the requester owns and that is trade eligible. */
  offeredCollectibleId: uuidSchema,
  /** A collectible listed for trade by someone else. */
  requestedCollectibleId: uuidSchema,
  message: z.string().trim().max(280, 'Mensagem muito longa.').optional(),
});

export const listCollectiblesSchema = z.object({
  rarity: z.enum(RARITIES).optional(),
  perfectOnly: z.enum(['true', 'false']).optional(),
  tradableOnly: z.enum(['true', 'false']).optional(),
  listedOnly: z.enum(['true', 'false']).optional(),
  minCompletion: z.coerce.number().min(0).max(100).optional(),
  search: z.string().trim().max(80).optional(),
});

export const setTradeListingSchema = z.object({
  listed: z.boolean(),
});

export type CreateTradeOfferInput = z.infer<typeof createTradeOfferSchema>;
export type ListCollectiblesInput = z.infer<typeof listCollectiblesSchema>;
