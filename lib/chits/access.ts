import { auth } from '@/lib/auth';
import { getActiveBranchId } from '@/lib/branch';
import { requireModule } from '@/lib/moduleGate';
import { getDefaultTenantId } from '@/lib/tenant';
import type { StaffPermissions } from '@/lib/staffPermissions';
import type { ChitScope } from './types';

export function canViewChits(role?: string | null, perms?: StaffPermissions | null) {
  return (
    canAdminChits(role, perms) ||
    (role === 'agent' &&
      Boolean(
        perms?.canViewChits ||
          perms?.canAccessForemanPortal ||
          perms?.canConductAuction ||
          perms?.canCollectChits,
      ))
  );
}

export function canAdminChits(role?: string | null, perms?: StaffPermissions | null) {
  return (
    role === 'admin' ||
    role === 'superadmin' ||
    role === 'developer' ||
    (role === 'agent' && Boolean(perms?.canManageChits))
  );
}

export function canConductChitAuction(role?: string | null, perms?: StaffPermissions | null) {
  return canAdminChits(role, perms) || (role === 'agent' && Boolean(perms?.canConductAuction));
}

export function canCollectChits(role?: string | null, perms?: StaffPermissions | null) {
  return role === 'agent' || canAdminChits(role, perms) || Boolean(perms?.canCollectChits);
}

export function canApproveChitSecurity(role?: string | null, perms?: StaffPermissions | null) {
  return role === 'superadmin' || role === 'developer' || Boolean(perms?.canApproveSecurity);
}

export function canReleaseChitPayout(role?: string | null, perms?: StaffPermissions | null) {
  return (
    role === 'superadmin' ||
    role === 'developer' ||
    (role === 'agent' && Boolean(perms?.canReleasePayout))
  );
}

export function scopedChitGroupWhere(scope: ChitScope, extra: Record<string, unknown> = {}) {
  return {
    tenantId: scope.tenantId,
    appType: scope.appType,
    deletedAt: null,
    // No role exemption (SCOPE-15): branchId is the ACTIVE branch, null = All Branches.
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...extra,
  };
}

export async function getWebChitScope(): Promise<ChitScope> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
  const role = (session.user as any).role as string;
  const staffPermissions = ((session.user as any).staffPermissions as StaffPermissions | undefined) ?? null;
  const customRoleName = ((session.user as any).customRoleName as string | undefined) ?? null;
  const tenantId = await getDefaultTenantId();
  const appType = 'chitfunds';
  const branchId = await getActiveBranchId();
  await requireModule(tenantId, 'chitfunds');
  return {
    tenantId,
    appType,
    branchId,
    role,
    userId: session.user.id,
    customRoleName,
    staffPermissions,
  };
}

export function assertChitRole(role: string | null | undefined, allowed: string[]) {
  if (!role || !allowed.includes(role)) throw new Error('Forbidden');
}

export function assertChitCapability(allowed: boolean) {
  if (!allowed) throw new Error('Forbidden');
}
