import { useEffect, useState } from 'react';
import { fetchAuthenticatedImage } from '../services/apiClient';

/**
 * Loads an authenticated image and exposes an object URL for an <img> tag.
 *
 * Object URLs are cached by source URL, which is safe because every artwork URL
 * carries a content version token: a goal's URL changes the moment a new piece
 * is revealed, so a cached entry can never show stale progress.
 *
 * The cache is bounded and evicts oldest-first, revoking the object URL as it
 * goes so the blobs do not accumulate over a long session.
 */
const objectUrlCache = new Map<string, string>();
const MAX_CACHED_IMAGES = 60;

function remember(url: string, objectUrl: string): void {
  objectUrlCache.set(url, objectUrl);
  while (objectUrlCache.size > MAX_CACHED_IMAGES) {
    const oldest = objectUrlCache.keys().next().value;
    if (oldest === undefined) break;
    const stale = objectUrlCache.get(oldest);
    objectUrlCache.delete(oldest);
    if (stale) URL.revokeObjectURL(stale);
  }
}

export interface AuthenticatedImage {
  src: string | null;
  isLoading: boolean;
  hasError: boolean;
}

export function useAuthenticatedImage(url: string | null): AuthenticatedImage {
  const cached = url ? objectUrlCache.get(url) : undefined;
  const [src, setSrc] = useState<string | null>(cached ?? null);
  const [isLoading, setIsLoading] = useState(Boolean(url) && !cached);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!url) {
      setSrc(null);
      setIsLoading(false);
      return undefined;
    }

    const existing = objectUrlCache.get(url);
    if (existing) {
      setSrc(existing);
      setIsLoading(false);
      setHasError(false);
      return undefined;
    }

    let cancelled = false;
    setIsLoading(true);
    setHasError(false);

    fetchAuthenticatedImage(url)
      .then((blob) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        remember(url, objectUrl);
        setSrc(objectUrl);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHasError(true);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { src, isLoading, hasError };
}
