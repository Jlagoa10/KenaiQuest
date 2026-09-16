import type { ApiErrorBody } from '@kenai/shared';

/**
 * API client.
 *
 * The access token is kept in memory only — never in localStorage — so an XSS
 * bug cannot exfiltrate a long-lived credential. The refresh token lives in an
 * httpOnly cookie the browser sends only to /api/auth, and this client
 * transparently rotates the access token when a request comes back 401.
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
/** Shared across concurrent 401s so only one refresh round trip happens. */
let refreshPromise: Promise<boolean> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, string[]> | undefined;

  constructor(status: number, code: string, message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Builds an absolute API URL. No component ever hardcodes a backend address. */
export function apiUrl(path: string): string {
  return `${API_BASE}/api${path.startsWith('/') ? path : `/${path}`}`;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Set for the refresh call itself, to avoid an infinite retry loop. */
  skipRefresh?: boolean;
}

async function rawRequest(path: string, options: RequestOptions = {}): Promise<Response> {
  return rawFetch(apiUrl(path), options);
}

async function rawFetch(url: string, options: RequestOptions = {}): Promise<Response> {
  const { body, skipRefresh: _skipRefresh, headers, ...rest } = options;

  const requestHeaders = new Headers(headers);
  if (accessToken) requestHeaders.set('Authorization', `Bearer ${accessToken}`);

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    // Let the browser set the multipart boundary.
    payload = body;
  } else if (body !== undefined) {
    requestHeaders.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }

  return fetch(url, {
    ...rest,
    headers: requestHeaders,
    // Sends the refresh cookie on the endpoints scoped to receive it.
    credentials: 'include',
    ...(payload !== undefined ? { body: payload } : {}),
  });
}

async function attemptRefresh(): Promise<boolean> {
  refreshPromise ??= (async () => {
    try {
      const response = await fetch(apiUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) return false;

      const data = (await response.json()) as { accessToken?: string };
      if (!data.accessToken) return false;

      accessToken = data.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so concurrent callers share this result.
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    }
  })();

  return refreshPromise;
}

async function toApiError(response: Response): Promise<ApiError> {
  let code = 'UNKNOWN_ERROR';
  let message = 'Não foi possível concluir a ação. Tente novamente.';
  let details: Record<string, string[]> | undefined;

  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body?.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      details = body.error.details;
    }
  } catch {
    // A non-JSON error (proxy, gateway) keeps the friendly default above.
  }

  return new ApiError(response.status, code, message, details);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await rawRequest(path, options);

  // A 401 on an authenticated call means the short-lived access token expired.
  // Rotate once and replay; if that fails the session is genuinely over.
  if (response.status === 401 && !options.skipRefresh) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      response = await rawRequest(path, options);
    } else {
      accessToken = null;
      onUnauthorized?.();
      throw await toApiError(response);
    }
  }

  if (!response.ok) throw await toApiError(response);

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};

/**
 * Fetches an authenticated image.
 *
 * The composited artwork endpoints are protected by the same Bearer token as
 * the rest of the API, and a plain `<img src>` cannot attach an Authorization
 * header — so the image has to be fetched here and handed to the element as an
 * object URL.
 *
 * Using fetch (rather than a query-string token) keeps a single auth mechanism
 * and still benefits from the browser HTTP cache: the URL carries a version
 * token that only changes when a new piece is unlocked, so a repeat view is
 * served from cache or revalidated against the server ETag.
 */
export async function fetchAuthenticatedImage(absoluteUrl: string): Promise<Blob> {
  let response = await rawFetch(absoluteUrl, { method: 'GET' });

  if (response.status === 401) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      response = await rawFetch(absoluteUrl, { method: 'GET' });
    } else {
      accessToken = null;
      onUnauthorized?.();
      throw await toApiError(response);
    }
  }

  if (!response.ok) throw await toApiError(response);
  return response.blob();
}
