import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  const tenantId = (session?.user as any)?.tenantId;

  if (!userId || !role || !['admin', 'superadmin', 'developer'].includes(role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { customerId } = await params;

  if (!customerId) {
    return NextResponse.json({ success: false, error: 'customerId is required' }, { status: 400 });
  }

  const reports = await prisma.bureauReport.findMany({
    where: {
      customerId,
      tenantId,
    },
    select: {
      id: true,
      bureauProvider: true,
      pullType: true,
      status: true,
      creditScore: true,
      scoreModel: true,
      totalAccounts: true,
      activeAccounts: true,
      overdueAccounts: true,
      totalOverdueAmt: true,
      enquiryCount90d: true,
      activeMFILoans: true,
      activeMFILoanAmt: true,
      consentTimestamp: true,
      consentMethod: true,
      validUntil: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return NextResponse.json({ success: true, data: reports });
}
