/**
 * Browser-side BFF client. Islands call the same-origin `/api/v1/*` proxy, which
 * mints a tenant-scoped JWT and forwards to workers — the browser never
 * holds a service credential. Server-side code uses `productClient` instead.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/v1/${path}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = (await res.json()) as { error?: string; message?: string };
      msg = j.error ?? j.message ?? msg;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, msg);
  }

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('application/json') ? ((await res.json()) as T) : (undefined as T);
}

/** Tenant-scoped CRUD helpers. `path` is relative to `/api/v1/` (no leading slash). */
export const api = {
  get: <T>(path: string) => req<T>('GET', path),
  post: <T>(path: string, body?: unknown) => req<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => req<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => req<T>('PUT', path, body),
  del: <T = void>(path: string) => req<T>('DELETE', path),
};
