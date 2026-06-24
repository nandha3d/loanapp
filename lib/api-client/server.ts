import { auth } from '@/lib/auth';
import { getUserAppType } from '@/lib/tenant';
import { apiFetch, type ApiFetchOptions } from './index';

export type ApiRequestContext = Pick<
  ApiFetchOptions,
  'token' | 'tenantSlug' | 'branchId' | 'appType'
>;

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

  return {
    token,
    tenantSlug: session?.user?.tenantSlug ?? undefined,
    branchId: session?.user?.branchId ?? undefined,
    appType,
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
