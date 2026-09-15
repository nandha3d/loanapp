import { auth } from '@/lib/auth';
import { getCurrentTenantId, getUserAppType } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import { apiError } from '@/lib/utils';
import { isSubscriptionAccessError } from '@/lib/subscription';

export const ADMIN_API_ROLES = ['admin', 'superadmin', 'developer'];
export const AUTHENTICATED_API_ROLES = ['admin', 'superadmin', 'developer', 'agent'];

export type ApiContext = {
  role: string;
  userId: string;
  branchId: string | null;
  tenantId: string;
  appType: string;
};

export type ApiContextResult =
  | { context: ApiContext; response?: never }
  | { context?: never; response: Response };

export async function requireApiContext(allowedRoles: string[] = AUTHENTICATED_API_ROLES): Promise<ApiContextResult> {
  const session = await auth();
  if (!session?.user?.id) return { response: apiError('Unauthorized', 401) };

  const role = (session.user as { role?: string })?.role || '';
  if (!allowedRoles.includes(role)) return { response: apiError('Forbidden', 403) };

  let tenantId: string;
  try {
    tenantId = await getCurrentTenantId();
  } catch (error) {
    if (isSubscriptionAccessError(error)) {
      return { response: apiError(error.message, error.statusCode) };
    }
    throw error;
  }
  const appType = await getUserAppType();
  const branchId = await getActiveBranchId();

  return {
    context: {
      role,
      userId: session.user.id,
      branchId,
      tenantId,
      appType,
    },
  };
}

/**
 * The one branch scope for web-session handlers. `context.branchId` is the
 * caller's active branch (`getActiveBranchId`), already null for developers and
 * for a superadmin on "All Branches" — those stay tenant-wide.
 *
 * A record belongs to exactly one branch: its own `branchId`. See
 * `lib/branchScope.ts` for why the "reach" variant that also matched unbranched
 * records and the filer's branch was removed.
 */
export function scopedBranchWhere(context: ApiContext) {
  return context.branchId ? { branchId: context.branchId } : {};
}

export function isApiError(result: ApiContextResult): result is { response: Response } {
  return Boolean(result.response);
}
