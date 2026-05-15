import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';

export type ActionContext = {
  userId: string;
  tenantId: string;
  role: string;
};

export type ActionResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Validates the user session and tenant context for server actions.
 * @param allowedRoles Array of roles permitted to execute this action. If empty, all authenticated users are allowed.
 */
export async function withActionAuth<T>(
  allowedRoles: string[] = [],
  action: (context: ActionContext) => Promise<ActionResponse<T>>
): Promise<ActionResponse<T>> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const role = (session?.user as any)?.role;
    
    if (!userId || !role) {
      return { success: false, error: 'Unauthorized: No active session' };
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const tenantId = await getDefaultTenantId();
    if (!tenantId) {
      return { success: false, error: 'Invalid tenant context' };
    }

    return await action({ userId, tenantId, role });
  } catch (error: any) {
    console.error('[Server Action Error]', error);
    return { success: false, error: error.message || 'An unexpected server error occurred' };
  }
}
