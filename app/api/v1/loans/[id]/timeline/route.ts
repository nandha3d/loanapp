import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { resolveActor } from '@/lib/api/dualAuth';

export type TimelineEvent = {
  at: string;            // ISO timestamp
  type:
    | 'disbursed'
    | 'collection'
    | 'penalty'
    | 'penalty_settled'
    | 'nach_debit'
    | 'npa_change'
    | 'closed';
  title: string;
  amount?: number;
  meta?: Record<string, string | number | null>;
};

/**
 * GET /api/v1/loans/[id]/timeline
 * Unified event feed for a loan: disbursal → collections (with GPS badge) →
 * penalties → NACH debits → NPA transitions → closure. Read-only; assembled
 * from existing tables, no schema change.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await resolveActor(req);
  if (!actor) return fail('Unauthorized', 401);

  const { id } = await params;

  const loan = await prisma.loan.findFirst({
    where: { id, tenantId: actor.tenantId, deletedAt: null },
    select: {
      id: true, loanCode: true, status: true, startDate: true, createdAt: true,
      disbursed: true, closedAt: true, closureType: true, foreclosureAmount: true,
      npaStatus: true, npaSubCategory: true, npaDaysOverdue: true,
    },
  });
  if (!loan) return fail('Loan not found', 404);

  const [entries, penalties, presentations, npaHistory] = await Promise.all([
    prisma.collectionEntry.findMany({
      where: { loanId: id },
      select: {
        id: true, receivedAmount: true, paymentMode: true, submittedAt: true,
        locationStatus: true, distanceFromCustomerM: true,
        agent: { select: { name: true } },
      },
      orderBy: { submittedAt: 'asc' },
      take: 500,
    }),
    prisma.penalty.findMany({
      where: { loanId: id },
      select: {
        id: true, grossPenalty: true, settledAmount: true, waivedAmount: true,
        status: true, createdAt: true, settledAt: true, missedDays: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    }),
    prisma.nachPresentation.findMany({
      where: { loanId: id },
      select: { id: true, amount: true, status: true, presentedAt: true, failureReason: true },
      orderBy: { presentedAt: 'asc' },
      take: 200,
    }),
    prisma.npaHistory.findMany({
      where: { loanId: id },
      select: { id: true, fromCategory: true, toCategory: true, daysOverdue: true, triggeredBy: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 100,
    }),
  ]);

  const events: TimelineEvent[] = [];

  events.push({
    at: loan.startDate.toISOString(),
    type: 'disbursed',
    title: `Loan ${loan.loanCode} disbursed`,
    amount: Number(loan.disbursed),
  });

  for (const e of entries) {
    events.push({
      at: e.submittedAt.toISOString(),
      type: 'collection',
      title: `Collection by ${e.agent?.name ?? 'agent'}`,
      amount: Number(e.receivedAmount),
      meta: {
        paymentMode: e.paymentMode,
        locationStatus: e.locationStatus,
        distanceM: e.distanceFromCustomerM,
      },
    });
  }

  for (const p of penalties) {
    events.push({
      at: p.createdAt.toISOString(),
      type: 'penalty',
      title: `Penalty applied (${p.missedDays} missed day${p.missedDays === 1 ? '' : 's'})`,
      amount: Number(p.grossPenalty),
      meta: { status: p.status },
    });
    if (p.settledAt) {
      events.push({
        at: p.settledAt.toISOString(),
        type: 'penalty_settled',
        title: Number(p.waivedAmount) > 0 ? 'Penalty settled / waived' : 'Penalty settled',
        amount: Number(p.settledAmount),
        meta: { waived: Number(p.waivedAmount) },
      });
    }
  }

  for (const pr of presentations) {
    events.push({
      at: pr.presentedAt.toISOString(),
      type: 'nach_debit',
      title: `e-NACH debit ${pr.status}`,
      amount: Number(pr.amount),
      meta: { status: pr.status, failureReason: pr.failureReason },
    });
  }

  for (const h of npaHistory) {
    events.push({
      at: h.createdAt.toISOString(),
      type: 'npa_change',
      title: `NPA: ${h.fromCategory} → ${h.toCategory}`,
      meta: { daysOverdue: h.daysOverdue, triggeredBy: h.triggeredBy },
    });
  }

  if (loan.closedAt) {
    events.push({
      at: loan.closedAt.toISOString(),
      type: 'closed',
      title: loan.closureType === 'foreclosure' ? 'Loan foreclosed' : 'Loan closed',
      amount: loan.foreclosureAmount ? Number(loan.foreclosureAmount) : undefined,
      meta: { closureType: loan.closureType },
    });
  }

  events.sort((a, b) => a.at.localeCompare(b.at));

  return ok({
    loanId: loan.id,
    loanCode: loan.loanCode,
    npa: {
      status: loan.npaStatus,
      subCategory: loan.npaSubCategory,
      daysOverdue: loan.npaDaysOverdue,
    },
    events,
  });
}
