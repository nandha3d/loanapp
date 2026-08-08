import 'server-only';
import { notifyUser } from './userNotify';

type NotifyApproversInput = {
  tenantId: string;
  /** Branch the record itself sits on. */
  branchId?: string | null;
  /**
   * Branch of the staff member who filed the record. Often the same as
   * `branchId`, but not always — a customer inherits the branch of its ROUTE, so
   * an agent on branch A working a route in branch B files records onto B while
   * their own admin sits on A.
   */
  requesterBranchId?: string | null;
  appType?: string;
  type: string;
  title: string;
  message: string;
  icon?: string | null;
  link?: string | null;
};

/**
 * Notify everyone who can act on an approval: the relevant branch admins AND the
 * tenant's superadmins (tenant-wide — a superadmin owns the tenant and may sit
 * on a different/no branch, so we never branch-filter them).
 *
 * Admins are scoped to the record's branch AND the filing agent's branch, plus
 * any admin with no branch assigned (an unbranched admin can review every
 * branch). Covering both branches matters: when the two differ, scoping to the
 * record's branch alone left approvals reaching no admin at all, visible only to
 * superadmins.
 *
 * If that still reaches nobody, every admin in the tenant is notified rather
 * than dropping the approval silently. Each call fans out to one per-user row
 * via notifyUser. Never throws.
 */
export async function notifyApprovers(input: NotifyApproversInput): Promise<void> {
  const { requesterBranchId, ...rest } = input;

  // Admins on the record's branch or the filer's branch, plus unbranched admins.
  const reached = await notifyUser({
    ...rest,
    targetRole: 'admin',
    branchId: input.branchId ?? null,
    recipientBranchIds: [input.branchId, requesterBranchId],
    includeUnassignedBranch: true,
  });

  // Nobody matched — fall back to every admin in the tenant. An approval that
  // reaches no admin is worse than one that reaches too many.
  if (reached === 0) {
    await notifyUser({
      ...rest,
      targetRole: 'admin',
      branchId: input.branchId ?? null,
      recipientBranchIds: [],
    });
  }

  // Tenant superadmins — always tenant-wide.
  await notifyUser({ ...rest, targetRole: 'superadmin', branchId: null, recipientBranchIds: [] });
}
