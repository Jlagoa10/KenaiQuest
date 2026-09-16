/** Artwork upload limits — enforced on the server, mirrored in the admin UI. */
export const MAX_ARTWORK_FILE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_ARTWORK_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type AllowedArtworkMimeType = (typeof ALLOWED_ARTWORK_MIME_TYPES)[number];

export const ALLOWED_ARTWORK_EXTENSIONS: Record<AllowedArtworkMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export const ARTWORK_NAME_MIN_LENGTH = 2;
export const ARTWORK_NAME_MAX_LENGTH = 80;
