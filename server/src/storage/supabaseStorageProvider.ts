import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { StorageProvider, StoredObject, UploadParams } from './StorageProvider.js';

/**
 * Production driver: Supabase Storage.
 *
 * Uses the service role key, which is why every call in this file runs on the
 * server only. The bucket is expected to be PRIVATE — artwork bytes are never
 * served from a public bucket URL, they are streamed through the API after the
 * server has masked the pieces the user has not unlocked yet.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly driver = 'supabase' as const;
  readonly bucket: string;
  private readonly client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string, bucket: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.bucket = bucket;
  }

  async upload({ path, body, contentType }: UploadParams): Promise<StoredObject> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, body, { contentType, upsert: false });

    if (error) {
      throw new Error(`Falha ao enviar arquivo para o Supabase Storage: ${error.message}`);
    }
    return { bucket: this.bucket, path };
  }

  async download(object: StoredObject): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(object.bucket).download(object.path);
    if (error || !data) {
      throw new Error(`Falha ao baixar arquivo do Supabase Storage: ${error?.message ?? 'vazio'}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async remove(object: StoredObject): Promise<void> {
    const { error } = await this.client.storage.from(object.bucket).remove([object.path]);
    if (error) {
      throw new Error(`Falha ao remover arquivo do Supabase Storage: ${error.message}`);
    }
  }

  async exists(object: StoredObject): Promise<boolean> {
    const lastSlash = object.path.lastIndexOf('/');
    const folder = lastSlash === -1 ? '' : object.path.slice(0, lastSlash);
    const filename = lastSlash === -1 ? object.path : object.path.slice(lastSlash + 1);

    const { data, error } = await this.client.storage
      .from(object.bucket)
      .list(folder, { search: filename, limit: 1 });

    if (error) return false;
    return (data ?? []).some((entry) => entry.name === filename);
  }
}
