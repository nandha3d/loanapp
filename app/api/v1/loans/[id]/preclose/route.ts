import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { precloseLoanInTx, PrecloseQuoteError } from '@/lib/loanPreclose';
import { ensurePendingPenaltiesForMissedLoans, PenaltyResolutionError, postPenaltyCollection } from '@/lib/penalties';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (ctx.role === 'agent') {
    return fail('Unauthorized', 403);
  }

  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId: ctx.tenantId },
    select: { foreclosureEnabled: true },
  });

  if (!sub?.foreclosureEnabled) {
    return fail('Preclose & Early Settlement add-on is not active under your plan subscription.', 403);
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid body', 400);
  }

  const amount = Number(body.amount);
  const paymentMode = typeof body.paymentMode === 'string' ? body.paymentMode : 'cash';
  const remarks = typeof body.remarks === 'string' ? body.remarks : '';
  const discount = typeof body.discount === 'number' && Number.isFinite(body.discount) ? Math.max(0, body.discount) : 0;
  const markChequesReturned = body.markChequesReturned === true;

  if (isNaN(amount) || amount <= 0) {
    return fail('Invalid amount', 400);
  }

  const loan = await prisma.loan.findFirst({
    where: {
      id,
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      ...scopedBranchWhere(ctx),
    },
    include: {
      customer: true,
      instalments: {
        orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
      },
    },
  });

  if (!loan) {
    return fail('Loan not found', 404);
  }

  try {
    // DEC-01: same penalty figure the quote showed (accrual first, then quote in tx).
    await ensurePendingPenaltiesForMissedLoans({ tenantId: ctx.tenantId, loanId: loan.id });
    const result = await prisma.$transaction(async (tx) => {
      return precloseLoanInTx(tx, ctx, loan, {
        amount, paymentMode, remarks, discount, markChequesReturned,
        penaltyResolution: body.penaltyResolution,
      });
    });
    for (const entry of result.penaltyEntries) {
      await postPenaltyCollection(ctx.tenantId, ctx.appType, ctx.userId, entry);
    }

    return ok({ success: true, penaltyOutcome: result.penaltyOutcome });
  } catch (error: any) {
    if (error instanceof PrecloseQuoteError) {
      return NextResponse.json({ data: error.data ?? null, error: error.message, pagination: null }, { status: error.status });
    }
    if (error instanceof PenaltyResolutionError) return fail(error.message, error.status);
    console.error('Error preclosing loan:', error);
    return fail(error.message || 'Failed to preclose loan', 500);
  }
}
