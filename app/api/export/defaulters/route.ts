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

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();

  const overdueLoans = await prisma.loan.findMany({
    where: { tenantId, appType, status: { in: ['overdue', 'active'] } },
    include: {
      customer: { select: { name: true, customerCode: true, phone: true, address: true } },
      penalties: { where: { status: 'pending' } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Only include loans with overdue instalments or pending penalties
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueWithPenalties = overdueLoans.filter(
    (l) => l.status === 'overdue' || l.penalties.length > 0
  );

  const header = 'Loan Code,Customer Code,Customer Name,Phone,Address,Status,Pending Penalty (total),Missed Payments\n';
  const rows = overdueWithPenalties.map((l) => {
    const totalPenalty = l.penalties.reduce((s, p) => s + Number(p.grossPenalty) - Number(p.settledAmount) - Number(p.waivedAmount), 0);
    return [
      l.loanCode,
      l.customer.customerCode,
      `"${l.customer.name.replace(/"/g, '""')}"`,
      l.customer.phone,
      `"${(l.customer.address || '').replace(/"/g, '""')}"`,
      l.status,
      totalPenalty.toFixed(2),
      l.penalties.reduce((s, p) => s + p.missedDays, 0),
    ].join(',');
  });

  const csv = header + rows.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="defaulters-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
