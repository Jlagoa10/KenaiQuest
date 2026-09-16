/**
 * Storage abstraction.
 *
 * Business logic (reward engine, admin artwork management, image compositing)
 * only ever talks to this interface. Swapping local disk for Supabase Storage
 * is therefore a configuration change, not a rewrite: nothing above this layer
 * knows which implementation is in use, and no code path outside `storage/`
 * ever builds a filesystem path or a bucket URL.
 */
export interface StoredObject {
  bucket: string;
  path: string;
}

export interface UploadParams {
  /** Storage key, already sanitised by the caller. Never a user supplied name. */
  path: string;
  body: Buffer;
  contentType: string;
}

export interface StorageProvider {
  readonly bucket: string;
  /** Human readable name used in logs and the admin panel. */
  readonly driver: 'supabase' | 'local';

  upload(params: UploadParams): Promise<StoredObject>;
  download(object: StoredObject): Promise<Buffer>;
  remove(object: StoredObject): Promise<void>;
  exists(object: StoredObject): Promise<boolean>;
}
