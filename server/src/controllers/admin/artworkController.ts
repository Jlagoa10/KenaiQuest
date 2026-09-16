import type { Request, Response } from 'express';
import type { CreateArtworkInput, Rarity, UpdateArtworkInput } from '@kenai/shared';
import { createArtworkSchema } from '@kenai/shared';
import { requireUser } from '../../middleware/authenticate.js';
import { AppError, ErrorCodes } from '../../utils/errors.js';
import * as artworkService from '../../services/artworkService.js';
import { renderFullArtwork } from '../../services/imageCompositor.js';

export async function listArtworks(req: Request, res: Response): Promise<void> {
  const rarity = req.query.rarity as Rarity | undefined;
  const isActiveRaw = req.query.isActive as string | undefined;
  const search = req.query.search as string | undefined;

  const artworks = await artworkService.listArtworks({
    ...(rarity ? { rarity } : {}),
    ...(isActiveRaw === 'true' || isActiveRaw === 'false'
      ? { isActive: isActiveRaw === 'true' }
      : {}),
    ...(search ? { search } : {}),
  });

  res.json({ artworks });
}

export async function createArtwork(req: Request, res: Response): Promise<void> {
  const admin = requireUser(req);

  if (!req.file) {
    throw new AppError(422, ErrorCodes.UPLOAD_INVALID, 'Envie um arquivo de imagem.');
  }

  // Multipart fields arrive as strings, so the body is parsed here rather than
  // by the usual validate() middleware, which runs before multer.
  const parsed = createArtworkSchema.safeParse(req.body);
  if (!parsed.success) {
    const details: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_';
      (details[key] ??= []).push(issue.message);
    }
    throw new AppError(
      400,
      ErrorCodes.VALIDATION_ERROR,
      'Verifique os campos informados.',
      details,
    );
  }

  const artwork = await artworkService.createArtwork({
    input: parsed.data as CreateArtworkInput,
    file: req.file,
    adminId: admin.id,
  });

  res.status(201).json({ artwork });
}

export async function updateArtwork(req: Request, res: Response): Promise<void> {
  const artwork = await artworkService.updateArtwork(
    req.params.id as string,
    req.body as UpdateArtworkInput,
  );
  res.json({ artwork });
}

export async function deleteArtwork(req: Request, res: Response): Promise<void> {
  await artworkService.deleteArtwork(req.params.id as string);
  res.status(204).send();
}

/** Admin-only full preview. Regular users can never reach this route. */
export async function previewArtwork(req: Request, res: Response): Promise<void> {
  const artwork = await artworkService.getArtworkRecord(req.params.id as string);
  const png = await renderFullArtwork(artwork);

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(png);
}
