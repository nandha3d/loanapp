import { auth } from '@/lib/auth';
import { getCurrentTenantId, getUserAppType } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import { apiError } from '@/lib/utils';

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

  const tenantId = await getCurrentTenantId();
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

export function scopedBranchWhere(context: ApiContext) {
  return context.branchId ? { branchId: context.branchId } : {};
}

export function isApiError(result: ApiContextResult): result is { response: Response } {
  return Boolean(result.response);
}
