import { z } from 'zod';
import { RARITIES } from '../constants/rarity.js';
import { ARTWORK_NAME_MAX_LENGTH, ARTWORK_NAME_MIN_LENGTH } from '../constants/uploads.js';

export const artworkNameSchema = z
  .string()
  .trim()
  .min(ARTWORK_NAME_MIN_LENGTH, 'Informe o nome da arte.')
  .max(ARTWORK_NAME_MAX_LENGTH, 'Nome muito longo.');

/** Multipart fields arrive as strings, hence the explicit boolean coercion. */
const booleanFromForm = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

export const createArtworkSchema = z.object({
  name: artworkNameSchema,
  description: z.string().trim().max(500, 'Descrição muito longa.').optional(),
  rarity: z.enum(RARITIES, { errorMap: () => ({ message: 'Selecione uma raridade válida.' }) }),
  isActive: booleanFromForm.optional().default(true),
});

export const updateArtworkSchema = z
  .object({
    name: artworkNameSchema.optional(),
    description: z.string().trim().max(500, 'Descrição muito longa.').nullable().optional(),
    rarity: z.enum(RARITIES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Nenhuma alteração foi enviada.',
  });

export const listArtworksSchema = z.object({
  rarity: z.enum(RARITIES).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  search: z.string().trim().max(80).optional(),
});

export type CreateArtworkInput = z.infer<typeof createArtworkSchema>;
export type UpdateArtworkInput = z.infer<typeof updateArtworkSchema>;
