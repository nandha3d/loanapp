/**
 * Thin client for the JWT API namespace.
 *
 * Branch isolation is far easier to assert here than through the DOM: the
 * `X-Branch-Id` header is exactly the branch switcher, and the response is the
 * scoped row set. Everything the operator does in the browser lands in the same
 * lib/ functions (STRUCT-3), so an API assertion is not a weaker assertion.
 */
import { BASE_URL } from './env';

export type ApiEnvelope<T = any> = {
  status: number;
  data: T | null;
  error: string | null;
  raw: any;
};

export type Session = { token: string; user: any };

async function call(
  method: string,
  path: string,
  opts: { token?: string; branchId?: string | null; appType?: string; body?: any; headers?: Record<string, string> } = {},
): Promise<ApiEnvelope> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.branchId !== undefined && opts.branchId !== null) headers['X-Branch-Id'] = opts.branchId;
  if (opts.branchId === null) headers['X-Branch-Id'] = 'all';
  if (opts.appType) headers['X-App-Type'] = opts.appType;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let raw: any = null;
  try {
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = { parseError: text.slice(0, 300) };
  }
  return {
    status: res.status,
    data: raw && 'data' in raw ? raw.data : raw,
    error: raw && 'error' in raw ? raw.error : null,
    raw,
  };
}

export const api = {
  get: (path: string, opts?: Parameters<typeof call>[2]) => call('GET', path, opts),
  post: (path: string, body: any, opts?: Parameters<typeof call>[2]) => call('POST', path, { ...opts, body }),
  patch: (path: string, body: any, opts?: Parameters<typeof call>[2]) => call('PATCH', path, { ...opts, body }),
  del: (path: string, opts?: Parameters<typeof call>[2]) => call('DELETE', path, opts),
};

export async function loginApi(username: string, password: string): Promise<Session> {
  const res = await call('POST', '/api/v1/auth/login', { body: { username, password } });
  if (res.status !== 200 || !res.data?.token) {
    throw new Error(`API login failed for ${username}: ${res.status} ${res.error ?? ''}`);
  }
  return { token: res.data.token, user: res.data.user };
}

/** Registration is a plain session-namespace route, not v1. */
export async function registerTenant(body: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/api/register/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const raw = await res.json().catch(() => null);
  return { status: res.status, raw };
}

/**
 * Write a tenant AppSetting through the app, not straight into the table.
 *
 * `getTenantSettings` memoises settings per tenant in the server process and
 * only drops that cache inside `setSetting`. A test that writes the row with
 * Prisma therefore changes nothing the running server can see — the flag reads
 * stale until the process restarts.
 */
export async function setTenantSetting(session: Session, key: string, value: string) {
  const res = await api.post('/api/v1/settings', { [key]: value }, { token: session.token });
  if (res.status >= 300) {
    throw new Error(`Could not set ${key}=${value}: ${res.status} ${res.error ?? ''}`);
  }
  return res;
}
