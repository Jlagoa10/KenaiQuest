import sharp from 'sharp';
import { cellToPixelRect, computePieceGrid } from '@kenai/shared';
import { ARTWORK_CACHE_MAX_ENTRIES, IMAGE_CACHE_MAX_ENTRIES } from '../config/constants.js';
import { getStorageProvider } from '../storage/index.js';
import { logger } from '../utils/logger.js';
import type { ArtworkRecord } from '../types/models.js';

/**
 * Server-side image compositing — the mechanism that makes the mystery real.
 *
 * The artwork bucket is private and its bytes are never handed to the browser.
 * Instead this module rebuilds a PNG containing ONLY the regions the user has
 * unlocked, on a TRANSPARENT background, and the API streams that. A user who
 * opens devtools sees exactly what they have earned and nothing more.
 *
 * Masking the image in CSS would have been far simpler, but it would ship the
 * whole artwork to the client and make the secret cosmetic.
 *
 * Transparency (rather than a baked-in grey) is deliberate: the client draws the
 * locked and missed cells itself, so the placeholder can follow the active
 * theme. See client/src/components/puzzle/KenaiPuzzle.tsx.
 */

interface CacheEntry<T> {
  value: T;
  insertedAt: number;
}

/** Small insertion-ordered LRU. Avoids a dependency for a 200-entry cache. */
class LruCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly maxEntries: number) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    // Refresh recency.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, { value, insertedAt: Date.now() });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
  }
}

const sourceCache = new LruCache<Buffer>(ARTWORK_CACHE_MAX_ENTRIES);
const compositeCache = new LruCache<Buffer>(IMAGE_CACHE_MAX_ENTRIES);

export function clearImageCaches(): void {
  sourceCache.clear();
  compositeCache.clear();
}

async function loadSourceArtwork(artwork: ArtworkRecord): Promise<Buffer> {
  const key = `${artwork.storageBucket}/${artwork.storagePath}`;
  const cached = sourceCache.get(key);
  if (cached) return cached;

  const storage = getStorageProvider();
  const buffer = await storage.download({
    bucket: artwork.storageBucket,
    path: artwork.storagePath,
  });
  sourceCache.set(key, buffer);
  return buffer;
}

export interface CompositeParams {
  artwork: ArtworkRecord;
  totalPieces: number;
  revealedPieceIndexes: number[];
  /** Stable token identifying this exact set of revealed pieces. */
  version: string;
  /** Longest edge of the output, in pixels. Keeps mobile payloads small. */
  maxDimension?: number;
}

/**
 * Builds a PNG showing only the revealed regions of the artwork.
 * Results are cached by version, so repeat views cost nothing; unlocking a new
 * piece changes the version and produces a fresh render.
 */
export async function compositeRevealedImage(params: CompositeParams): Promise<Buffer> {
  const maxDimension = params.maxDimension ?? 1200;
  const cacheKey = `${params.artwork.id}:${params.version}:${maxDimension}`;

  const cached = compositeCache.get(cacheKey);
  if (cached) return cached;

  const source = await loadSourceArtwork(params.artwork);

  // Nothing unlocked yet: a fully transparent canvas of the right shape, so the
  // client renders the mystery placeholder at the correct aspect ratio.
  const { width, height } = scaleToFit(params.artwork.width, params.artwork.height, maxDimension);

  if (params.revealedPieceIndexes.length === 0) {
    const empty = await sharp({
      create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();
    compositeCache.set(cacheKey, empty);
    return empty;
  }

  const resized = await sharp(source)
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const grid = computePieceGrid(params.totalPieces, params.artwork.width / params.artwork.height);
  const revealed = new Set(params.revealedPieceIndexes);

  // Copy revealed cells into an otherwise transparent RGBA canvas. Working on
  // the raw buffer keeps this O(revealed pixels) with no per-cell encode.
  const channels = 4;
  const output = Buffer.alloc(width * height * channels, 0);
  const input = resized.data;

  for (const cell of grid.cells) {
    if (!revealed.has(cell.index)) continue;
    const rect = cellToPixelRect(cell, width, height);

    for (let row = 0; row < rect.height; row += 1) {
      const y = rect.top + row;
      if (y >= height) break;
      const rowStart = (y * width + rect.left) * channels;
      const rowLength = Math.min(rect.width, width - rect.left) * channels;
      input.copy(output, rowStart, rowStart, rowStart + rowLength);
    }
  }

  const png = await sharp(output, { raw: { width, height, channels } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  compositeCache.set(cacheKey, png);
  return png;
}

/** Full artwork, used for admin previews only. Never reachable by a normal user. */
export async function renderFullArtwork(
  artwork: ArtworkRecord,
  maxDimension = 900,
): Promise<Buffer> {
  const source = await loadSourceArtwork(artwork);
  const { width, height } = scaleToFit(artwork.width, artwork.height, maxDimension);
  return sharp(source).resize(width, height, { fit: 'fill' }).png().toBuffer();
}

function scaleToFit(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width, height };
  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Reads intrinsic dimensions and validates that the bytes really are an image. */
export async function inspectImage(
  buffer: Buffer,
): Promise<{ width: number; height: number; format: string }> {
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height || !metadata.format) {
    throw new Error('Não foi possível ler as dimensões da imagem.');
  }
  return { width: metadata.width, height: metadata.height, format: metadata.format };
}

/**
 * Re-encodes an upload, discarding any embedded metadata.
 * Beyond normalising the format, this strips EXIF and any non-image payload
 * smuggled into the original file.
 */
export async function normaliseUpload(buffer: Buffer): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  contentType: string;
}> {
  const image = sharp(buffer, { failOn: 'error' });
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Arquivo de imagem inválido.');
  }

  const normalised = await image.rotate().png({ compressionLevel: 9 }).toBuffer();
  const finalMeta = await sharp(normalised).metadata();

  logger.debug(
    { from: metadata.format, width: finalMeta.width, height: finalMeta.height },
    'Upload normalizado para PNG',
  );

  return {
    buffer: normalised,
    width: finalMeta.width ?? metadata.width,
    height: finalMeta.height ?? metadata.height,
    contentType: 'image/png',
  };
}
