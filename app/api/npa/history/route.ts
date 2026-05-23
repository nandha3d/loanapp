import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

/**
 * GET /api/npa/history?loanId=xxx
 *
 * Returns NPA classification history for a specific loan.
 * Shows every transition: Standard → SMA → Sub-Standard → Doubtful etc.
 * Subscription-gated: requires npaEnabled = true.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  const tenantId = user.tenantId;
  const role = user.role;

  if (!['admin', 'superadmin'].includes(role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // Check subscription gating
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { npaEnabled: true },
  });

  if (!subscription || !subscription.npaEnabled) {
    return NextResponse.json(
      { success: false, error: 'NPA Classification module is not enabled for your subscription.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const loanId = searchParams.get('loanId');

  if (!loanId) {
    return NextResponse.json({ success: false, error: 'loanId query param is required' }, { status: 400 });
  }

  // Verify the loan belongs to this tenant
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, tenantId },
    select: { id: true },
  });

  if (!loan) {
    return NextResponse.json({ success: false, error: 'Loan not found' }, { status: 404 });
  }

  const history = await prisma.npaHistory.findMany({
    where: { loanId, tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fromCategory: true,
      toCategory: true,
      daysOverdue: true,
      outstandingAmt: true,
      triggeredBy: true,
      triggeredById: true,
      notes: true,
      provisioningRate: true,
      provisioningAmount: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ success: true, data: history });
}
