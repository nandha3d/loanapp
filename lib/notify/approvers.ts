import 'server-only';
import { notifyUser } from './userNotify';

type NotifyApproversInput = {
  tenantId: string;
  branchId?: string | null;
  appType?: string;
  type: string;
  title: string;
  message: string;
  icon?: string | null;
  link?: string | null;
};

/**
 * Notify everyone who can act on an approval: the branch's admins AND the
 * tenant's superadmins (tenant-wide — a superadmin owns the tenant and may sit
 * on a different/no branch, so we never branch-filter them).
 *
 * Admins are scoped to the branch, plus any admin with no branch assigned: an
 * unbranched admin can review every branch, so branch-filtering them out left
 * approvals visible to superadmins only. Each call fans out to one per-user row
 * via notifyUser. Never throws.
 */
export async function notifyApprovers(input: NotifyApproversInput): Promise<void> {
  // Branch admins + unbranched admins (or all admins if no branch is known).
  await notifyUser({
    ...input,
    targetRole: 'admin',
    branchId: input.branchId ?? null,
    includeUnassignedBranch: true,
  });
  // Tenant superadmins — always tenant-wide.
  await notifyUser({ ...input, targetRole: 'superadmin', branchId: null });
}
