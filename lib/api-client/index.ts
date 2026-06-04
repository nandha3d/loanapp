const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiFetchOptions extends RequestInit {
  token?: string;
  tenantSlug?: string;
  branchId?: string | null;
}

function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const prefix = `${API_BASE}/api/v1`;

  if (typeof window === 'undefined' && !prefix.startsWith('http')) {
    const appUrl = (
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'
    ).replace(/\/+$/, '');
    return `${appUrl}/api/v1${normalizedPath}`;
  }

  return `${prefix}${normalizedPath}`;
}

function isFormDataBody(body: BodyInit | null | undefined): boolean {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { token, tenantSlug, branchId, ...fetchOptions } = options;

  const headers = new Headers(fetchOptions.headers);

  if (!isFormDataBody(fetchOptions.body ?? null) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (tenantSlug) {
    headers.set('X-Tenant-Slug', tenantSlug);
  }
  if (branchId) {
    headers.set('X-Branch-Id', branchId);
  }

  const res = await fetch(apiUrl(path), {
    ...fetchOptions,
    headers,
    cache: fetchOptions.cache ?? 'no-store',
  });

  const body = await res.text();

  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const parsed = JSON.parse(body);
      message = parsed?.error ?? parsed?.message ?? message;
    } catch {
      if (body) message = body;
    }
    throw new ApiError(res.status, body, message);
  }

  if (!body || res.status === 204) return undefined as T;

  return JSON.parse(body) as T;
}
