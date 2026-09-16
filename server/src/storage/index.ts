import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { LocalStorageProvider } from './localStorageProvider.js';
import { SupabaseStorageProvider } from './supabaseStorageProvider.js';
import type { StorageProvider } from './StorageProvider.js';

let provider: StorageProvider | null = null;

/** Resolved once, lazily, so importing this module never requires credentials. */
export function getStorageProvider(): StorageProvider {
  if (provider) return provider;

  if (env.STORAGE_DRIVER === 'supabase') {
    provider = new SupabaseStorageProvider(
      env.SUPABASE_URL as string,
      env.SUPABASE_SERVICE_ROLE_KEY as string,
      env.SUPABASE_STORAGE_BUCKET,
    );
    logger.info({ bucket: env.SUPABASE_STORAGE_BUCKET }, 'Storage: Supabase Storage');
  } else {
    provider = new LocalStorageProvider(env.STORAGE_LOCAL_DIR, env.SUPABASE_STORAGE_BUCKET);
    logger.warn(
      { dir: env.STORAGE_LOCAL_DIR },
      'Storage: disco local (desenvolvimento). Defina STORAGE_DRIVER=supabase em produção.',
    );
  }

  return provider;
}

/** Test seam. */
export function setStorageProvider(next: StorageProvider | null): void {
  provider = next;
}

export type { StorageProvider, StoredObject } from './StorageProvider.js';
