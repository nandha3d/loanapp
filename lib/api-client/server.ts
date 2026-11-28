import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getActiveBranchId } from '@/lib/branch';
import { getUserAppType } from '@/lib/tenant';
import { apiFetch, type ApiFetchOptions } from './index';

export type ApiRequestContext = Pick<
  ApiFetchOptions,
  'token' | 'tenantSlug' | 'branchId' | 'appType' | 'baseOrigin'
>;

export function resolveServerOriginFromHeaders(hdrs: {
  get(name: string): string | null;
}): string | undefined {
  const directHost = hdrs.get('host')?.trim() || '';
  const forwardedHost = hdrs.get('x-forwarded-host')?.split(',')[0]?.trim() || '';
  const forwardedProto = hdrs.get('x-forwarded-proto')?.split(',')[0]?.trim() || '';

  if (/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/i.test(directHost)) {
    return `http://${directHost}`;
  }

  const effectiveHost = forwardedHost || directHost;
  if (!effectiveHost) return undefined;

  const isLocalHost =
    /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(effectiveHost) ||
    /\.(test|local|localhost)(:\d+)?$/i.test(effectiveHost);
  const proto = isLocalHost ? 'http' : (forwardedProto || 'https');
  return `${proto}://${effectiveHost}`;
}

type ApiSession = {
  apiToken?: string;
  user?: {
    tenantSlug?: string | null;
    branchId?: string | null;
  } | null;
} | null;

/**
 * Gets the API token from the current NextAuth session.
 * Only usable in Server Components and Route Handlers.
 */
export async function getApiToken(): Promise<string> {
  const session = await auth() as ApiSession;
  const token = session?.apiToken;
  if (!token) throw new Error('Unauthenticated');
  return token;
}

export async function getApiRequestContext(): Promise<ApiRequestContext> {
  const session = await auth() as ApiSession;
  const token = session?.apiToken;
  if (!token) throw new Error('Unauthenticated');

  const appType = await getUserAppType();
  // The ACTIVE branch, not the user's home branch. For a superadmin the two
  // differ: they sit on one branch and work all of them through the branch
  // switcher, so sending their home branch stamped every record they created
  // with their own branch. `getActiveBranchId` is role-aware and
  // DB-authoritative; v1 re-validates it against the tenant before honouring it.
  const branchId = await getActiveBranchId();
  let baseOrigin: string | undefined;
  try {
    baseOrigin = resolveServerOriginFromHeaders(await headers());
  } catch {
    baseOrigin = undefined;
  }

  return {
    token,
    tenantSlug: session?.user?.tenantSlug ?? undefined,
    branchId: branchId ?? undefined,
    appType,
    baseOrigin,
  };
}

/**
 * Convenience wrapper — gets the token and calls apiFetch in one step.
 * Use this in Server Components instead of calling both separately.
 */
export async function serverFetch<T>(
  path: string,
  options: Omit<ApiFetchOptions, 'token'> = {},
): Promise<T> {
  const context = await getApiRequestContext();

  return apiFetch<T>(path, {
    ...options,
    ...context,
  });
}
