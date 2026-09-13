import prisma from './db';
import type { MobileTokenClaims } from './api/v1-auth';
import { getSetting } from './tenant';
import { getDictionary } from './i18n';
import { buildAgentCustomerAccessWhere } from './loanPolicy';
import { branchScopeWhere } from './branchScope';
import { notifyApprovers } from './notify/approvers';
import { notifyUser } from './notify/userNotify';
import { modulePath } from '@/types/modules';
import { precloseLoanInTx } from './loanPreclose';
import { AGENT_PRECLOSE_FLAG, LOAN_PRECLOSE_REQUEST, canRequestLoanPreclose, isPrecloseRequestLoan, isValidPrecloseAmount, precloseOutstanding } from './loanPreclosePolicy';

export class PrecloseRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function submitLoanPrecloseRequest(ctx: MobileTokenClaims, body: Record<string, unknown>) {
  const d = (await getDictionary(ctx.tenantId)).precloseRequest;
  const enabled = await getSetting(ctx.tenantId, AGENT_PRECLOSE_FLAG, '0') === '1';
  if (!canRequestLoanPreclose(ctx.role, ctx.appType, enabled)) throw new PrecloseRequestError(d.unavailable, 403);
  let changes: unknown;
  try { changes = typeof body.requestedChanges === 'string' ? JSON.parse(body.requestedChanges) : body.requestedChanges; }
  catch { throw new PrecloseRequestError(d.invalid, 400); }
  if (body.entityType !== 'loan' || typeof body.entityId !== 'string' ||
      !changes || typeof changes !== 'object' || Array.isArray(changes) ||
      typeof body.reason !== 'string' || !body.reason.trim()) throw new PrecloseRequestError(d.invalid, 400);
  const { amount, paymentMode, remarks = '' } = changes as Record<string, unknown>;
  if (typeof paymentMode !== 'string' || !['cash', 'upi', 'cheque', 'bank_transfer'].includes(paymentMode) ||
      typeof remarks !== 'string') throw new PrecloseRequestError(d.invalid, 400);
  const entityId = body.entityId;
  const reason = body.reason.trim();
  const result = await prisma.$transaction(async tx => {
    // ApprovalRequest has no partial unique index for pending requests. Lock the
    // subject to serialize submissions without changing the loan or its terms.
    await tx.$queryRaw`SELECT id FROM loans WHERE id = ${entityId} AND tenant_id = ${ctx.tenantId} AND app_type = ${ctx.appType} FOR UPDATE`;
    const loan = await tx.loan.findFirst({
      where: { id: entityId, tenantId: ctx.tenantId, appType: ctx.appType,
        customer: buildAgentCustomerAccessWhere({ userId: ctx.userId }) },
      include: { customer: { select: { name: true } } },
    });
    if (!loan) throw new PrecloseRequestError(d.notFound, 404);
    if (!isPrecloseRequestLoan(loan)) throw new PrecloseRequestError(d.ineligible, 409);
    const outstanding = precloseOutstanding(loan);
    if (!isValidPrecloseAmount(amount, outstanding)) throw new PrecloseRequestError(d.amountChanged, 409);
    const pending = await tx.approvalRequest.findFirst({
      where: { tenantId: ctx.tenantId, appType: ctx.appType, requestType: LOAN_PRECLOSE_REQUEST,
        entityType: 'loan', entityId, status: 'pending' },
    });
    if (pending) throw new PrecloseRequestError(d.pending, 409);
    const request = await tx.approvalRequest.create({ data: {
      tenantId: ctx.tenantId, appType: ctx.appType, requestType: LOAN_PRECLOSE_REQUEST,
      entityType: 'loan', entityId, requestedById: ctx.userId, reason,
      requestedChanges: JSON.stringify({ loanCode: loan.loanCode, amount, paymentMode, remarks }),
    } });
    await tx.auditLog.create({ data: { tenantId: ctx.tenantId, userId: ctx.userId, action: 'create',
      entityType: 'approval_request', entityId: request.id,
      newValue: JSON.stringify({ requestType: LOAN_PRECLOSE_REQUEST, loanId: loan.id, amount, paymentMode }) } });
    return { request, loan };
  }, { isolationLevel: 'ReadCommitted' });
  await notifyApprovers({ tenantId: ctx.tenantId, appType: ctx.appType,
    branchId: result.loan.branchId, requesterBranchId: ctx.branchId, requesterRole: ctx.role,
    type: LOAN_PRECLOSE_REQUEST, icon: 'request_quote', title: d.title,
    message: `${result.loan.loanCode}: ${d.reviewHint}`, link: modulePath(ctx.appType, '/approvals') });
  return result.request;
}

// ApprovalRequest has no branch column/relation. Resolve ONLY this new request
// type through its subject loan; existing approval types retain their behavior.
export async function precloseApprovalVisibility(tenantId: string, appType: string, branchId: string) {
  const requests = await prisma.approvalRequest.findMany({ where: { tenantId, appType, requestType: LOAN_PRECLOSE_REQUEST, entityType: 'loan' }, select: { entityId: true } });
  const loans = requests.length ? await prisma.loan.findMany({
    where: { tenantId, appType, id: { in: requests.map(request => request.entityId) }, ...branchScopeWhere(branchId) }, select: { id: true },
  }) : [];
  return { requestType: LOAN_PRECLOSE_REQUEST, entityType: 'loan', entityId: { in: loans.map(loan => loan.id) } };
}

export async function reviewLoanPrecloseRequest(ctx: MobileTokenClaims, requestId: string, action: string, reviewNotes: string) {
  const d = (await getDictionary(ctx.tenantId)).precloseRequest;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role) || ctx.appType !== 'microlending') throw new PrecloseRequestError(d.unavailable, 403);
  if (action !== 'approve' && action !== 'reject') throw new PrecloseRequestError(d.invalid, 400);
  if (action === 'approve' && await getSetting(ctx.tenantId, AGENT_PRECLOSE_FLAG, '0') !== '1') throw new PrecloseRequestError(d.unavailable, 403);
  const result = await prisma.$transaction(async tx => {
    const request = await tx.approvalRequest.findFirst({ where: { id: requestId, tenantId: ctx.tenantId, appType: ctx.appType,
      requestType: LOAN_PRECLOSE_REQUEST, entityType: 'loan', status: 'pending' } });
    if (!request) throw new PrecloseRequestError(d.notFound, 404);
    await tx.$queryRaw`SELECT id FROM loans WHERE id = ${request.entityId} AND tenant_id = ${ctx.tenantId} AND app_type = ${ctx.appType} FOR UPDATE`;
    const loan = await tx.loan.findFirst({ where: { id: request.entityId, tenantId: ctx.tenantId, appType: ctx.appType,
      ...branchScopeWhere(ctx.branchId) }, include: { customer: true } });
    if (!loan) throw new PrecloseRequestError(d.notFound, 404);
    const claimed = await tx.approvalRequest.updateMany({ where: { id: requestId, tenantId: ctx.tenantId, appType: ctx.appType, status: 'pending' },
      data: { status: action === 'approve' ? 'approved' : 'rejected', reviewedById: ctx.userId, reviewedAt: new Date(), reviewNotes } });
    if (claimed.count !== 1) throw new PrecloseRequestError(d.notFound, 409);
    if (action === 'approve') {
      const changes = JSON.parse(request.requestedChanges);
      if (!isPrecloseRequestLoan(loan)) throw new PrecloseRequestError(d.ineligible, 409);
      if (!isValidPrecloseAmount(changes.amount, precloseOutstanding(loan))) throw new PrecloseRequestError(d.amountChanged, 409);
      if (!['cash', 'upi', 'cheque', 'bank_transfer'].includes(changes.paymentMode) || typeof changes.remarks !== 'string') throw new PrecloseRequestError(d.invalid, 400);
      await precloseLoanInTx(tx, ctx, loan, changes);
    }
    await tx.auditLog.create({ data: { tenantId: ctx.tenantId, userId: ctx.userId, action,
      entityType: 'loan', entityId: loan.id,
      newValue: JSON.stringify({ requestId, requestType: LOAN_PRECLOSE_REQUEST, requestedById: request.requestedById, reviewNotes }) } });
    return { request, loan };
  }, { isolationLevel: 'ReadCommitted' });
  await notifyUser({ tenantId: ctx.tenantId, appType: ctx.appType, branchId: result.loan.branchId,
    targetUserId: result.request.requestedById, targetRole: 'agent', type: `request_${action === 'approve' ? 'approved' : 'rejected'}`,
    icon: action === 'approve' ? 'check_circle' : 'cancel', title: d.title,
    message: `${result.loan.loanCode}: ${action === 'approve' ? d.approved : d.rejected}${reviewNotes ? ` ${reviewNotes}` : ''}`,
    link: modulePath(ctx.appType, `/loans/${result.loan.loanCode}`) });
  return { success: true as const };
}
