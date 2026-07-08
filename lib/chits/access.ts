import { auth } from '@/lib/auth';
import { getActiveBranchId } from '@/lib/branch';
import { requireModule } from '@/lib/moduleGate';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import type { ChitScope } from './types';

export function isTenantWideRole(role?: string | null) {
  return role === 'superadmin' || role === 'developer';
}

export function canAdminChits(role?: string | null) {
  return role === 'admin' || role === 'superadmin' || role === 'developer';
}

export function canCollectChits(role?: string | null) {
  return role === 'agent' || canAdminChits(role);
}

export function canApproveChitSecurity(role?: string | null) {
  return role === 'superadmin' || role === 'developer';
}

export function scopedChitGroupWhere(scope: ChitScope, extra: Record<string, unknown> = {}) {
  return {
    tenantId: scope.tenantId,
    appType: scope.appType,
    deletedAt: null,
    ...(scope.branchId && !isTenantWideRole(scope.role) ? { branchId: scope.branchId } : {}),
    ...extra,
  };
}

export async function getWebChitScope(): Promise<ChitScope> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
  const role = (session.user as any).role as string;
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const branchId = await getActiveBranchId();
  await requireModule(tenantId, 'chitfunds');
  return {
    tenantId,
    appType,
    branchId,
    role,
    userId: session.user.id,
  };
}

export function assertChitRole(role: string | null | undefined, allowed: string[]) {
  if (!role || !allowed.includes(role)) throw new Error('Forbidden');
}
