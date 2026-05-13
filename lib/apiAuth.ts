import { auth } from '@/lib/auth';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
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

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();

  return {
    context: {
      role,
      userId: session.user.id,
      branchId: (session.user as { branchId?: string | null })?.branchId || null,
      tenantId,
      appType,
    },
  };
}

export function scopedBranchWhere(context: ApiContext) {
  return context.role === 'admin' && context.branchId ? { branchId: context.branchId } : {};
}

export function isApiError(result: ApiContextResult): result is { response: Response } {
  return Boolean(result.response);
}
