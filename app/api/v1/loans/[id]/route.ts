import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { computeRestructure, restructuredAmountFor } from '@/lib/restructure';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  const loan = await prisma.loan.findFirst({
    where: {
      id,
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      ...scopedBranchWhere(ctx),
    },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, phone: true } },
      instalments: { orderBy: { instalmentNo: 'asc' } },
      penalties: { orderBy: { createdAt: 'desc' } },
      collaterals: true,
    },
  });
  if (!loan) return fail('Loan not found', 404);

  // Restructured rate — computed server-side (single source of truth). Each
  // instalment gets a `restructuredAmount`; the loan carries the loan-level
  // figures. Clients render these directly and never recompute.
  const restructure = computeRestructure(loan.instalments);
  const instalments = loan.instalments.map((inst) => ({
    ...inst,
    restructuredAmount: restructuredAmountFor(inst, restructure.restructuredRate),
  }));

  return ok({ ...loan, instalments, restructure });
}

/**
 * PATCH /api/v1/loans/[id] — request a loan edit.
 * Mirrors the web's approval-gated `requestLoanEdit`: computes a diff of the
 * submitted editable fields vs the current loan and files an ApprovalRequest
 * (requestType 'loan_edit'). Schedule-affecting core fields are rejected if the
 * loan already has repayments (same guard as web). No schedule math runs here.
 */
const LOAN_EDIT_SCALAR_FIELDS = [
  'penaltyRate',
  'voucherRef',
  'loanType',
  'collateralDetails',
  'dueDay',
] as const;
const LOAN_EDIT_CORE_FIELDS = ['principal', 'tenure', 'frequency', 'startDate'] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  const loan = await prisma.loan.findFirst({
    where: { id, tenantId: ctx.tenantId, appType: ctx.appType, ...scopedBranchWhere(ctx) },
  });
  if (!loan) return fail('Loan not found', 404);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail('Invalid body', 400);
  }
  const reason = typeof body.reason === 'string' ? body.reason : '';

  const proposed: Record<string, unknown> = {};
  // Scalar (non-schedule) fields — safe to change without regenerating instalments.
  for (const f of LOAN_EDIT_SCALAR_FIELDS) {
    if (body[f] === undefined) continue;
    const current = (loan as any)[f];
    const next = body[f];
    const changed =
      f === 'penaltyRate' || f === 'dueDay'
        ? Number(current ?? 0) !== Number(next ?? 0)
        : String(current ?? '') !== String(next ?? '');
    if (changed) proposed[f] = f === 'penaltyRate' || f === 'dueDay' ? Number(next) : next;
  }

  // Core schedule fields — guard against loans with recorded activity.
  let coreChanged = false;
  for (const f of LOAN_EDIT_CORE_FIELDS) {
    if (body[f] === undefined) continue;
    const current = f === 'startDate' ? new Date(loan.startDate).toISOString().slice(0, 10) : (loan as any)[f];
    const next = f === 'startDate' ? String(body[f]).slice(0, 10) : body[f];
    const changed =
      f === 'frequency' || f === 'startDate'
        ? String(current ?? '') !== String(next ?? '')
        : Number(current ?? 0) !== Number(next ?? 0);
    if (changed) {
      proposed[f] = f === 'principal' || f === 'tenure' ? Number(next) : next;
      coreChanged = true;
    }
  }

  if (coreChanged) {
    const { hasFinancialActivity } = await import('@/lib/repayments');
    if (await hasFinancialActivity(id)) {
      return fail(
        'Schedule cannot be regenerated: loan has recorded repayments. Close & renew instead.',
        409,
      );
    }
  }

  if (Object.keys(proposed).length === 0) return fail('No changes detected', 400);

  await prisma.approvalRequest.create({
    data: {
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      requestType: 'loan_edit',
      entityType: 'loan',
      entityId: id,
      requestedById: ctx.userId,
      requestedChanges: JSON.stringify(proposed),
      reason,
      status: 'pending',
    },
  });

  await prisma.systemNotification
    .create({
      data: {
        tenantId: ctx.tenantId,
        branchId: loan.branchId,
        appType: ctx.appType,
        type: 'loan_edit_review',
        icon: 'rate_review',
        title: 'Loan edit pending review',
        message: `Edit requested for loan ${loan.loanCode}.`,
        link: '/approvals',
        targetRole: 'admin',
      },
    })
    .catch(() => {});

  return ok({ requested: true, changes: proposed });
}
