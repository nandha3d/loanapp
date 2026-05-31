import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getBorrowerSession } from '@/lib/borrowerAuth';

/**
 * GET /api/portal/approvals  (borrower)
 * Pending photo-proof payments awaiting this client's approval.
 */
export async function GET() {
  const session = await getBorrowerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const approvals = await prisma.paymentApproval.findMany({
    where: { tenantId: session.tenantId, customerId: session.customerId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const loanIds = [...new Set(approvals.map((a) => a.loanId))];
  const loans = await prisma.loan.findMany({
    where: { id: { in: loanIds } },
    select: { id: true, loanCode: true },
  });
  const loanMap = new Map(loans.map((l) => [l.id, l.loanCode]));

  return NextResponse.json({
    approvals: approvals.map((a) => ({
      id: a.id,
      amount: Number(a.amount),
      paymentMode: a.paymentMode,
      photoPath: a.photoPath,
      loanCode: loanMap.get(a.loanId) ?? '',
      createdAt: a.createdAt.toISOString(),
    })),
  });
}
