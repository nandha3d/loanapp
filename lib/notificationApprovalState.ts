import prisma from './db';

/**
 * Server-side answer to "can this viewer Approve/Reject straight from this
 * notification?" (STABLE-8: clients render the flag, they never derive it).
 *
 * A notification is approval-linked when its `link` points at the approvals page
 * and carries the target id (`?id=`) — `notifyApprovers` guarantees that. The id
 * is an ApprovalRequest id, or a customer/loan id still in `pending_review`
 * (the approve/reject endpoints accept all three).
 */

const APPROVER_ROLES = new Set(['admin', 'superadmin', 'developer']);

export type NotificationApprovalState = {
  /** Target id when the row is approval-linked, else null. */
  approvalId: string | null;
  /** `pending` = still awaiting a decision, `handled` = someone already decided, null = not an approval row. */
  approvalStatus: 'pending' | 'handled' | null;
  /** True only for a pending request AND a viewer who may decide it. */
  canAct: boolean;
};

export function approvalIdFromLink(link: string | null | undefined): string | null {
  if (!link) return null;
  const [path, query = ''] = link.split('?');
  if (!/(^|\/)approvals(\/|$)/.test(path)) return null;
  const id = new URLSearchParams(query).get('id');
  return id && id.length > 0 ? id : null;
}

export async function resolveApprovalStates(
  ctx: { tenantId: string; appType: string; role: string },
  rows: Array<{ id: string; link: string | null }>,
): Promise<Map<string, NotificationApprovalState>> {
  const out = new Map<string, NotificationApprovalState>();
  const idByRow = new Map<string, string>();
  for (const r of rows) {
    const aid = approvalIdFromLink(r.link);
    if (aid) idByRow.set(r.id, aid);
  }
  const ids = [...new Set(idByRow.values())];
  const pending = new Set<string>();

  if (ids.length > 0) {
    const [reqs, customers, loans] = await Promise.all([
      prisma.approvalRequest.findMany({
        where: { id: { in: ids }, tenantId: ctx.tenantId, appType: ctx.appType, status: 'pending' },
        select: { id: true },
      }),
      prisma.customer.findMany({
        where: { id: { in: ids }, tenantId: ctx.tenantId, appType: ctx.appType, status: 'pending_review' },
        select: { id: true },
      }),
      prisma.loan.findMany({
        where: { id: { in: ids }, tenantId: ctx.tenantId, appType: ctx.appType, status: 'pending_review' },
        select: { id: true },
      }),
    ]);
    for (const r of [...reqs, ...customers, ...loans]) pending.add(r.id);
  }

  const mayDecide = APPROVER_ROLES.has(ctx.role);
  for (const r of rows) {
    const aid = idByRow.get(r.id);
    if (!aid) {
      out.set(r.id, { approvalId: null, approvalStatus: null, canAct: false });
      continue;
    }
    const isPending = pending.has(aid);
    out.set(r.id, {
      approvalId: aid,
      approvalStatus: isPending ? 'pending' : 'handled',
      canAct: isPending && mayDecide,
    });
  }
  return out;
}
