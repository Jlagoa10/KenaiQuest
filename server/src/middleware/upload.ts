import multer from 'multer';
import { ALLOWED_ARTWORK_MIME_TYPES, MAX_ARTWORK_FILE_BYTES } from '@kenai/shared';
import { AppError, ErrorCodes } from '../utils/errors.js';

/**
 * Artwork upload handling.
 *
 * Files are held in memory, never written to disk under a client-supplied name,
 * and capped well below any practical artwork size. This is only the first
 * gate — artworkService re-decodes and re-encodes the bytes before anything is
 * stored, so a file that merely claims to be a PNG does not get through.
 */
export const artworkUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ARTWORK_FILE_BYTES,
    files: 1,
    fields: 10,
  },
  fileFilter: (_req, file, callback) => {
    if (!(ALLOWED_ARTWORK_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      callback(
        new AppError(
          422,
          ErrorCodes.UPLOAD_INVALID,
          'Formato inválido. Envie uma imagem PNG, JPEG ou WebP.',
        ),
      );
      return;
    }
    callback(null, true);
  },
}).single('file');
