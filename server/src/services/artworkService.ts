import { randomUUID } from 'node:crypto';
import type { ArtworkDto, CreateArtworkInput, Rarity, UpdateArtworkInput } from '@kenai/shared';
import { ALLOWED_ARTWORK_EXTENSIONS, ALLOWED_ARTWORK_MIME_TYPES } from '@kenai/shared';
import { getStorageProvider } from '../storage/index.js';
import { AppError, ErrorCodes, notFound } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import * as artworkRepository from '../repositories/artworkRepository.js';
import type { ArtworkWithUsage } from '../repositories/artworkRepository.js';
import { clearImageCaches, inspectImage, normaliseUpload } from './imageCompositor.js';
import type { ArtworkRecord } from '../types/models.js';

export function toArtworkDto(artwork: ArtworkWithUsage): ArtworkDto {
  return {
    id: artwork.id,
    name: artwork.name,
    description: artwork.description,
    rarity: artwork.rarity,
    isActive: artwork.isActive,
    width: artwork.width,
    height: artwork.height,
    mimeType: artwork.mimeType,
    byteSize: artwork.byteSize,
    collectiblesAwarded: artwork.collectiblesAwarded,
    createdAt: artwork.createdAt.toISOString(),
    updatedAt: artwork.updatedAt.toISOString(),
    // Served through the API, never as a raw bucket URL, so a private bucket
    // stays private and the service role key is never needed by the browser.
    previewUrl: `/api/admin/artworks/${artwork.id}/preview.png`,
  };
}

/**
 * Validates and stores an uploaded artwork.
 *
 * Defence in depth on the file itself:
 *   - the declared MIME type must be in the allow list;
 *   - sharp must be able to decode the bytes, and the decoded format must match
 *     the allow list too — a .png extension on a script does not survive this;
 *   - the image is re-encoded, which strips EXIF and any appended payload;
 *   - the storage key is generated server side, so an uploaded filename never
 *     reaches the filesystem or the bucket.
 */
export async function createArtwork(params: {
  input: CreateArtworkInput;
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number };
  adminId: string;
}): Promise<ArtworkDto> {
  const declaredMime = params.file.mimetype;
  if (!(ALLOWED_ARTWORK_MIME_TYPES as readonly string[]).includes(declaredMime)) {
    throw new AppError(
      422,
      ErrorCodes.UPLOAD_INVALID,
      'Formato inválido. Envie uma imagem PNG, JPEG ou WebP.',
    );
  }

  let inspected: { width: number; height: number; format: string };
  try {
    inspected = await inspectImage(params.file.buffer);
  } catch {
    throw new AppError(
      422,
      ErrorCodes.UPLOAD_INVALID,
      'Não foi possível ler este arquivo como imagem.',
    );
  }

  const decodedMime = `image/${inspected.format === 'jpg' ? 'jpeg' : inspected.format}`;
  if (!(ALLOWED_ARTWORK_MIME_TYPES as readonly string[]).includes(decodedMime)) {
    throw new AppError(
      422,
      ErrorCodes.UPLOAD_INVALID,
      'Formato de imagem não suportado.',
    );
  }

  const normalised = await normaliseUpload(params.file.buffer);
  const storage = getStorageProvider();
  const extension = ALLOWED_ARTWORK_EXTENSIONS['image/png'];
  const storagePath = `artworks/${randomUUID()}.${extension}`;

  const stored = await storage.upload({
    path: storagePath,
    body: normalised.buffer,
    contentType: normalised.contentType,
  });

  try {
    const artwork = await artworkRepository.createArtwork({
      name: params.input.name,
      description: params.input.description ?? null,
      rarity: params.input.rarity,
      storageBucket: stored.bucket,
      storagePath: stored.path,
      width: normalised.width,
      height: normalised.height,
      mimeType: normalised.contentType,
      byteSize: normalised.buffer.byteLength,
      isActive: params.input.isActive ?? true,
      createdBy: params.adminId,
    });

    // A freshly created artwork has no usage yet, so the counters are zero.
    return toArtworkDto({ ...artwork, collectiblesAwarded: 0, activeGoals: 0 });
  } catch (error) {
    // Do not leave an orphan object in the bucket if the row fails to insert.
    await storage.remove(stored).catch(() => undefined);
    throw error;
  }
}

async function findArtworkWithUsage(id: string): Promise<ArtworkWithUsage | null> {
  const all = await artworkRepository.listArtworks({});
  return all.find((artwork) => artwork.id === id) ?? null;
}

export async function listArtworks(filters: {
  rarity?: Rarity;
  isActive?: boolean;
  search?: string;
}): Promise<ArtworkDto[]> {
  const artworks = await artworkRepository.listArtworks(filters);
  return artworks.map(toArtworkDto);
}

export async function updateArtwork(
  id: string,
  input: UpdateArtworkInput,
): Promise<ArtworkDto> {
  const updated = await artworkRepository.updateArtwork(id, input);
  if (!updated) throw notFound('Arte não encontrada.');

  clearImageCaches();
  const withUsage = await findArtworkWithUsage(id);
  if (!withUsage) throw notFound('Arte não encontrada.');
  return toArtworkDto(withUsage);
}

/**
 * Hard deletion is reserved for artwork nothing references.
 * Anything already assigned to a goal or awarded as a collectible must be
 * deactivated instead, so existing copies keep rendering forever.
 */
export async function deleteArtwork(id: string): Promise<void> {
  const artwork = await artworkRepository.findArtworkById(id);
  if (!artwork) throw notFound('Arte não encontrada.');

  const references = await artworkRepository.countArtworkReferences(id);
  if (references.goals > 0 || references.collectibles > 0) {
    throw new AppError(
      409,
      ErrorCodes.ARTWORK_IN_USE,
      'Esta arte já foi usada em metas ou coleções. Desative-a em vez de excluir.',
    );
  }

  await artworkRepository.deleteArtwork(id);

  const storage = getStorageProvider();
  await storage
    .remove({ bucket: artwork.storageBucket, path: artwork.storagePath })
    .catch((error: unknown) => {
      // The row is gone; a leftover object is not worth failing the request.
      logger.warn({ err: error, artworkId: id }, 'Falha ao remover arquivo do storage');
    });

  clearImageCaches();
}

export async function getArtworkRecord(id: string): Promise<ArtworkRecord> {
  const artwork = await artworkRepository.findArtworkById(id);
  if (!artwork) throw notFound('Arte não encontrada.');
  return artwork;
}
