import 'server-only';
import { notifyUser } from './userNotify';

type NotifyApproversInput = {
  tenantId: string;
  /** Branch the record itself sits on. */
  branchId?: string | null;
  /**
   * Branch of the staff member who filed the record. Often the same as
   * `branchId`, but not always — a customer inherits the branch of its ROUTE, so
   * an AGENT on branch A working a route in branch B files records onto B while
   * their own admin sits on A. Only honoured for agents: see below.
   */
  requesterBranchId?: string | null;
  /**
   * Role of the staff member who filed the record. Anything other than `agent`
   * makes `requesterBranchId` inert.
   */
  requesterRole?: string | null;
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
 * Admins on the record's own branch are the recipients, plus any admin with no
 * branch assigned (an unbranched admin is tenant-wide everywhere else in the
 * app, lists included). The filing AGENT's branch is added on top, because an
 * agent files onto their route's branch while their own manager sits elsewhere
 * and still needs to know their agent raised something.
 *
 * Two things this deliberately does NOT do, both of which leaked one branch's
 * approvals into another branch's notification bell:
 *
 *  - honour the filer's branch when the filer is NOT an agent. A superadmin
 *    sits on one branch and files for all of them, so their branch's admin was
 *    pinged about every branch's records — and, since the approvals queue is
 *    scoped to the record's own branch, could not open a single one of them;
 *  - fall back to every admin in the tenant when nobody matched. That sprayed a
 *    customer's name and amounts across branches that have no business seeing
 *    them. Nothing is dropped by removing it: the tenant's superadmins are
 *    notified on every call regardless.
 *
 * Each call fans out to one per-user row via notifyUser. Never throws.
 */
export async function notifyApprovers(input: NotifyApproversInput): Promise<void> {
  const { requesterBranchId, requesterRole, ...rest } = input;

  // Only an agent's own manager gets the extra ping; see above.
  const agentBranchId = requesterRole === 'agent' ? requesterBranchId : null;

  const reached = await notifyUser({
    ...rest,
    targetRole: 'admin',
    branchId: input.branchId ?? null,
    recipientBranchIds: [input.branchId, agentBranchId],
    includeUnassignedBranch: true,
  });

  if (reached === 0) {
    console.warn(
      `[notifyApprovers] no admin on branch ${input.branchId ?? '<none>'} for ${input.type} — superadmins only`,
    );
  }

  // Tenant superadmins — always tenant-wide recipients, but the row still
  // carries the record's branch so the notification stays traceable to it.
  await notifyUser({
    ...rest,
    targetRole: 'superadmin',
    branchId: input.branchId ?? null,
    recipientBranchIds: [],
  });
}
