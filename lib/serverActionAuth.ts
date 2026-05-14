import { auth } from '@/lib/auth';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';

export type ServerActionContext = {
  userId: string;
  tenantId: string;
  appType: string;
  role: string;
  branchId: string | null;
};

export const ADMIN_ROLES = ['admin', 'superadmin', 'developer'];
export const ALL_ROLES = ['admin', 'superadmin', 'developer', 'agent'];

/**
 * Resolves and validates the current user context for a server action.
 * Returns the context if the user has an allowed role, or null if unauthorized.
 *
 * Usage:
 *   const ctx = await getServerActionContext(ADMIN_ROLES);
 *   if (!ctx) return { success: false, error: 'Unauthorized' };
 */
export async function getServerActionContext(
  allowedRoles: string[] = ALL_ROLES,
): Promise<ServerActionContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const role = (session.user as any)?.role as string || '';
  if (!allowedRoles.includes(role)) return null;

  const [tenantId, appType] = await Promise.all([
    getDefaultTenantId(),
    getUserAppType(),
  ]);

  return {
    userId: session.user.id,
    role,
    branchId: (session.user as any)?.branchId ?? null,
    tenantId,
    appType,
  };
}
