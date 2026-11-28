import { auth } from '@/lib/auth';
import { getActiveBranchId } from '@/lib/branch';
import { requireModule } from '@/lib/moduleGate';
import { mergeStaffPermissions, type StaffPermissions } from '@/lib/staffPermissions';
import { getDefaultTenantId, getSetting } from '@/lib/tenant';
import type { ChitApprovalPolicy, ChitScope } from './types';

export const CHIT_ADMIN_APPROVE_SECURITY_KEY = 'chit_admin_approve_security';
export const CHIT_ADMIN_RELEASE_PAYOUT_KEY = 'chit_admin_release_payout';

export async function getChitApprovalPolicy(tenantId: string): Promise<ChitApprovalPolicy> {
  const [adminApprove, adminPayout] = await Promise.all([
    getSetting(tenantId, CHIT_ADMIN_APPROVE_SECURITY_KEY, '0'),
    getSetting(tenantId, CHIT_ADMIN_RELEASE_PAYOUT_KEY, '0'),
  ]);
  return {
    adminCanApproveSecurity: adminApprove === '1',
    adminCanReleasePayout: adminPayout === '1',
  };
}

export function canModifyChitApprovalPermissions(role?: string | null): boolean {
  return role === 'superadmin' || role === 'developer';
}

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

export function canApproveChitSecurity(
  role?: string | null,
  perms?: StaffPermissions | null,
  policy?: Partial<ChitApprovalPolicy> | null,
) {
  return (
    role === 'superadmin' ||
    role === 'developer' ||
    Boolean(perms?.canApproveSecurity) ||
    (role === 'admin' && Boolean(policy?.adminCanApproveSecurity))
  );
}

export function canReleaseChitPayout(
  role?: string | null,
  perms?: StaffPermissions | null,
  policy?: Partial<ChitApprovalPolicy> | null,
) {
  return (
    role === 'superadmin' ||
    role === 'developer' ||
    ((role === 'agent' || role === 'admin') && Boolean(perms?.canReleasePayout)) ||
    (role === 'admin' && Boolean(policy?.adminCanReleasePayout))
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
  const [, approvalPolicy] = await Promise.all([
    requireModule(tenantId, 'chitfunds'),
    getChitApprovalPolicy(tenantId),
  ]);
  return {
    tenantId,
    appType,
    branchId,
    role,
    userId: session.user.id,
    customRoleName,
    staffPermissions,
    approvalPolicy,
  };
}

export async function getChitMobileCapabilities(ctx: {
  tenantId: string;
  userId: string;
  role: string;
}) {
  if (ctx.role === 'superadmin' || ctx.role === 'developer') {
    return {
      staffPermissions: null as StaffPermissions | null,
      policy: { adminCanApproveSecurity: true, adminCanReleasePayout: true } as ChitApprovalPolicy,
      canConductAuction: true,
      canApproveSecurity: true,
      canReleasePayout: true,
    };
  }
  const prisma = (await import('@/lib/db')).default;
  const [policy, user] = await Promise.all([
    getChitApprovalPolicy(ctx.tenantId),
    prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        staffPermissions: true,
        customRole: { select: { status: true, permissionsJson: true } },
      },
    }),
  ]);
  const staffPermissions = user
    ? mergeStaffPermissions(
        user.customRole?.status === 'active' ? user.customRole.permissionsJson : null,
        user.staffPermissions,
      )
    : null;
  return {
    staffPermissions,
    policy,
    canConductAuction: canConductChitAuction(ctx.role, staffPermissions),
    canApproveSecurity: canApproveChitSecurity(ctx.role, staffPermissions, policy),
    canReleasePayout: canReleaseChitPayout(ctx.role, staffPermissions, policy),
  };
}

export function assertChitRole(role: string | null | undefined, allowed: string[]) {
  if (!role || !allowed.includes(role)) throw new Error('Forbidden');
}

export function assertChitCapability(allowed: boolean) {
  if (!allowed) throw new Error('Forbidden');
}
