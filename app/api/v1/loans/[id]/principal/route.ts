import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { randomUUID } from 'crypto';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notify/events';
import { isInterestOnly } from '@/lib/loanCalculator';
import { applyPartPayment } from '@/lib/gold/pledgeInterest';
import { summarizeInterestOnlyLoan, monthlyInterestFor } from '@/lib/interestOnly';

/**
 * Principal servicing for Interest-Only loans.
 *
 * Their instalments carry interest only — the principal is a bullet sitting outside
 * the schedule — so neither the collection flow (which pays instalments) nor
 * /preclose (which allocates a lump sum against one instalment) can settle it.
 *
 * Shape follows the gold pledge equivalent at
 * app/api/v1/gold/loans/[id]/servicing/route.ts; the ledger/transaction pattern
 * follows app/api/v1/loans/[id]/preclose/route.ts.
 */

type MobileContext = NonNullable<Awaited<ReturnType<typeof requireMobileContext>>['context']>;

async function loadInterestOnlyLoan(id: string, ctx: MobileContext) {
  const loan = await prisma.loan.findFirst({
    where: { id, tenantId: ctx.tenantId, appType: ctx.appType, ...scopedBranchWhere(ctx) },
    include: {
      customer: true,
      instalments: { orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }] },
    },
  });
  if (!loan) return { error: fail('Loan not found', 404), loan: null };
  if (!isInterestOnly(loan.deductionType)) {
    return { error: fail('This loan does not use the Interest-Only model', 400), loan: null };
  }
  return { error: null, loan };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  const loaded = await loadInterestOnlyLoan(id, ctx);
  if (loaded.error) return loaded.error;

  return ok(summarizeInterestOnlyLoan(loaded.loan));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  // Same restriction as /preclose — agents collect dues, they don't settle principal.
  if (ctx.role === 'agent') return fail('Unauthorized', 403);

  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  const paymentMode = typeof body.paymentMode === 'string' ? body.paymentMode : 'cash';
  const remarks = typeof body.remarks === 'string' ? body.remarks : '';
  if (!['part', 'close'].includes(action)) {
    return fail('action must be part | close', 400);
  }

  const loaded = await loadInterestOnlyLoan(id, ctx);
  if (loaded.error) return loaded.error;
  const { loan } = loaded;

  if (loan.status === 'closed') return fail('Loan is already closed', 409);
  if (loan.status === 'pending_review') {
    return fail('Cannot service a loan that has not been disbursed yet', 400);
  }

  const summary = summarizeInterestOnlyLoan(loan);
  const now = new Date();
  const isCash = !['upi', 'bank', 'online', 'neft', 'rtgs', 'imps'].includes(paymentMode);

  // A part-payment takes the operator's amount; a closure always settles the full
  // outstanding principal plus interest already due, so it is never under-collected.
  const amount = action === 'close' ? summary.totalDueToClose : Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail('Invalid amount', 400);
  }
  if (action === 'part' && amount >= summary.outstandingPrincipal) {
    return fail(
      'A part-payment must be less than the outstanding principal. Use Full Closure to settle the loan.',
      400,
    );
  }

  // A closure collects the principal bullet plus any interest already due; a
  // part-payment is all principal. The two legs hit different GL accounts, so they
  // are tracked separately for the journal entries below.
  const principalCollected = action === 'close' ? summary.outstandingPrincipal : amount;
  const interestCollected = action === 'close' ? summary.interestDueNow : 0;
  let paymentId = '';

  try {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId: ctx.tenantId,
          loanId: loan.id,
          amount,
          paymentMode,
          paymentType: action === 'close' ? 'redemption' : 'part',
          referenceNumber: `${action === 'close' ? 'CLOSE' : 'PARTPRIN'}-${randomUUID().slice(0, 8).toUpperCase()}`,
          paymentDate: now,
          status: 'completed',
        },
      });
      paymentId = payment.id;

      await tx.accountEntry.create({
        data: {
          tenantId: ctx.tenantId,
          appType: loan.appType,
          branchId: loan.branchId,
          entryDate: now,
          type: 'collection',
          category: isCash ? 'cash' : 'upi',
          amount,
          description:
            action === 'close'
              ? `Full closure: ${loan.customer.name} (${loan.loanCode})`
              : `Principal part-payment: ${loan.customer.name} (${loan.loanCode})`,
          referenceId: payment.id,
          referenceType: 'payment',
          createdBy: ctx.userId,
        },
      });

      if (action === 'part') {
        const newOutstanding = applyPartPayment(summary.outstandingPrincipal, amount);
        const newMonthlyInterest = monthlyInterestFor(newOutstanding, summary.monthlyRatePercent);

        // Only re-price dues that haven't come around yet. Paid, partial and missed
        // rows are settled history — rewriting them would restate what was already
        // collected or what the customer already fell behind on.
        await tx.instalment.updateMany({
          where: { loanId: loan.id, status: 'upcoming' },
          data: { dueAmount: newMonthlyInterest },
        });

        const remainingUpcoming = await tx.instalment.count({
          where: { loanId: loan.id, status: 'upcoming' },
        });

        await tx.loan.update({
          where: { id: loan.id },
          data: {
            outstandingPrincipal: newOutstanding,
            perInstalment: newMonthlyInterest,
            totalPayable:
              newOutstanding + summary.interestCollected + newMonthlyInterest * remainingUpcoming,
          },
        });
      } else {
        // Closure: settle every still-open due, then retire the schedule so nothing
        // is left looking collectable on a closed loan.
        await tx.instalment.updateMany({
          where: { loanId: loan.id, status: { in: ['upcoming', 'missed', 'partial'] } },
          data: {
            status: 'waived',
            remarks: remarks || 'Settled by full closure',
          },
        });

        await tx.loan.update({
          where: { id: loan.id },
          data: {
            status: 'closed',
            closedAt: now,
            closureType: 'full_closure',
            outstandingPrincipal: 0,
            foreclosureAmount: amount,
            foreclosureById: ctx.userId,
          },
        });
      }
    });
  } catch (error: unknown) {
    console.error('Interest-Only principal servicing failed:', error);
    const message = error instanceof Error ? error.message : '';
    return fail(message || 'Failed to record principal payment', 500);
  }

  // Premium double-entry, fire-and-forget and idempotent on the entry id. The legs
  // are posted separately because they credit different accounts: principal repays
  // the receivable (1310), interest is income (4100). Posting the lump sum as one
  // line would write the interest off the loan book.
  void import('@/lib/accounting/autoPost').then(async ({ autoPostCollection }) => {
    const common = {
      tenantId: ctx.tenantId,
      loanId: loan.id,
      loanCode: loan.loanCode,
      date: now,
      branchId: loan.branchId,
      createdById: ctx.userId,
      paymentMode,
    };
    if (principalCollected > 0) {
      await autoPostCollection({
        ...common,
        entryId: `${paymentId}-principal`,
        amount: principalCollected,
        creditKey: 'loan_receivable',
      });
    }
    if (interestCollected > 0) {
      await autoPostCollection({
        ...common,
        entryId: `${paymentId}-interest`,
        amount: interestCollected,
        creditKey: 'interest_income',
      });
    }
  }).catch((err) => console.error('Failed to post principal servicing JE', err));

  await writeAudit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: action === 'close' ? 'loan_full_closure' : 'loan_principal_part_payment',
    entityType: 'loan',
    entityId: loan.id,
    newValue: { amount, paymentMode, remarks },
  });

  if (action === 'close') {
    notify({
      tenantId: ctx.tenantId,
      event: 'loan_closed',
      phone: loan.customer.phone,
      email: loan.customer.email ?? undefined,
      data: { name: loan.customer.name, loanCode: loan.loanCode },
      meta: { entityType: 'loan', entityId: loan.id },
    }).catch((err) => console.error('Failed to send loan closed notification', err));
  }

  const refreshed = await loadInterestOnlyLoan(id, ctx);
  return ok({
    recorded: action,
    amount,
    ...(refreshed.loan ? summarizeInterestOnlyLoan(refreshed.loan) : {}),
  });
}
