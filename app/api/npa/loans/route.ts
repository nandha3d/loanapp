import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

/**
 * GET /api/npa/loans
 *
 * Returns paginated list of loans filtered by NPA category.
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
  const category = searchParams.get('category');
  const page = parseInt(searchParams.get('page') ?? '1');
  const pageSize = 20;

  const where: any = {
    tenantId,
    deletedAt: null,
  };

  if (category) {
    where.npaStatus = category;
  } else {
    where.npaStatus = {
      in: ['sma_0', 'sma_1', 'sma_2', 'sub_standard', 'doubtful_d1', 'doubtful_d2', 'doubtful_d3', 'loss'],
    };
  }

  const [loans, total] = await prisma.$transaction([
    prisma.loan.findMany({
      where,
      select: {
        id: true,
        loanCode: true,
        npaStatus: true,
        npaSubCategory: true,
        npaDaysOverdue: true,
        npaClassifiedAt: true,
        provisioningAmount: true,
        provisioningRate: true,
        npaUpgradeEligible: true,
        lastNpaReviewDate: true,
        totalPayable: true,
        totalCollected: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { npaDaysOverdue: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.loan.count({ where }),
  ]);

  const mappedLoans = loans.map((loan) => ({
    ...loan,
    outstandingAmount: Number(loan.totalPayable) - Number(loan.totalCollected),
  }));

  return NextResponse.json({ success: true, data: mappedLoans, total, page, pageSize });
}
