import type { StorageProvider, StoredObject, UploadParams } from './StorageProvider.js';

function encodeObjectPath(path: string): string {
  return path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

async function readError(response: Response): Promise<string> {
  const text = await response.text();

  if (!text) {
    return `${response.status} ${response.statusText}`;
  }

  try {
    const parsed = JSON.parse(text) as {
      message?: string;
      error?: string;
    };

    return parsed.message ?? parsed.error ?? text;
  } catch {
    return text;
  }
}

/**
 * Production driver: Supabase Storage.
 *
 * Uses the server-side secret/service-role key.
 * The bucket remains private. Artwork bytes are downloaded by the backend,
 * processed/masked, and only then returned to the frontend.
 *
 * This implementation uses the Supabase Storage REST API directly instead
 * of creating a full supabase-js client. That avoids initializing Realtime
 * and therefore works on the current Node.js 20 development environment.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly driver = 'supabase' as const;
  readonly bucket: string;

  private readonly storageUrl: string;
  private readonly serviceRoleKey: string;

  constructor(url: string, serviceRoleKey: string, bucket: string) {
    this.storageUrl = `${url.replace(/\/+$/, '')}/storage/v1`;
    this.serviceRoleKey = serviceRoleKey;
    this.bucket = bucket;
  }

  private authHeaders(): Record<string, string> {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
    };
  }

  async upload({ path, body, contentType }: UploadParams): Promise<StoredObject> {
    const response = await fetch(
      `${this.storageUrl}/object/${encodeURIComponent(this.bucket)}/${encodeObjectPath(path)}`,
      {
        method: 'POST',
        headers: {
          ...this.authHeaders(),
          'Content-Type': contentType,
          'x-upsert': 'false',
        },
        body: new Uint8Array(body),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Falha ao enviar arquivo para o Supabase Storage: ${await readError(response)}`,
      );
    }

    return {
      bucket: this.bucket,
      path,
    };
  }

  async download(object: StoredObject): Promise<Buffer> {
    const response = await fetch(
      `${this.storageUrl}/object/authenticated/${encodeURIComponent(
        object.bucket,
      )}/${encodeObjectPath(object.path)}`,
      {
        method: 'GET',
        headers: this.authHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Falha ao baixar arquivo do Supabase Storage: ${await readError(response)}`,
      );
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async remove(object: StoredObject): Promise<void> {
    const response = await fetch(
      `${this.storageUrl}/object/${encodeURIComponent(object.bucket)}`,
      {
        method: 'DELETE',
        headers: {
          ...this.authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefixes: [object.path],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Falha ao remover arquivo do Supabase Storage: ${await readError(response)}`,
      );
    }
  }

  async exists(object: StoredObject): Promise<boolean> {
    const lastSlash = object.path.lastIndexOf('/');
    const folder = lastSlash === -1 ? '' : object.path.slice(0, lastSlash);
    const filename =
      lastSlash === -1 ? object.path : object.path.slice(lastSlash + 1);

    const response = await fetch(
      `${this.storageUrl}/object/list/${encodeURIComponent(object.bucket)}`,
      {
        method: 'POST',
        headers: {
          ...this.authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefix: folder,
          limit: 100,
          offset: 0,
          search: filename,
        }),
      },
    );

    if (!response.ok) {
      return false;
    }

    const entries = (await response.json()) as Array<{ name?: string }>;

    return entries.some((entry) => entry.name === filename);
  }
}