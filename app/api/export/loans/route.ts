import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || role === 'agent') {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const statusFilter = searchParams.get('status') || '';

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();

  const where: any = { tenantId, appType };
  if (statusFilter) where.status = statusFilter;

  const loans = await prisma.loan.findMany({
    where,
    include: {
      customer: { select: { name: true, customerCode: true, phone: true } },
      branch: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const header = 'Loan Code,Customer Code,Customer Name,Phone,Branch,Principal,Disbursed,Frequency,Tenure,Start Date,End Date,Status,Paid Count,Total Collected,Created By\n';
  const rows = loans.map((l) =>
    [
      l.loanCode,
      l.customer.customerCode,
      `"${l.customer.name.replace(/"/g, '""')}"`,
      l.customer.phone,
      `"${(l.branch?.name || '').replace(/"/g, '""')}"`,
      l.principal.toString(),
      l.disbursed.toString(),
      l.frequency,
      l.tenure,
      l.startDate.toISOString().slice(0, 10),
      l.endDate ? l.endDate.toISOString().slice(0, 10) : '',
      l.status,
      l.paidCount,
      l.totalCollected.toString(),
      `"${(l.createdBy?.name || '').replace(/"/g, '""')}"`,
    ].join(',')
  );

  const csv = header + rows.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="loans-register-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
