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
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(searchParams.get('from') || today);
  const to = new Date(searchParams.get('to') || today);
  to.setHours(23, 59, 59, 999);
  from.setHours(0, 0, 0, 0);

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();

  const entries = await prisma.collectionEntry.findMany({
    where: {
      submittedAt: { gte: from, lte: to },
      collection: { tenantId, appType },
    },
    include: {
      customer: { select: { name: true, customerCode: true } },
      loan: { select: { loanCode: true } },
      agent: { select: { name: true } },
    },
    orderBy: { submittedAt: 'asc' },
  });

  const header = 'Date,Customer Code,Customer Name,Loan Code,Agent,Due Amount,Received,Payment Mode\n';
  const rows = entries.map((e) =>
    [
      e.submittedAt.toISOString().slice(0, 10),
      e.customer.customerCode,
      `"${e.customer.name.replace(/"/g, '""')}"`,
      e.loan.loanCode,
      `"${(e.agent?.name || '').replace(/"/g, '""')}"`,
      e.dueAmount.toString(),
      e.receivedAmount.toString(),
      e.paymentMode,
    ].join(',')
  );

  const csv = header + rows.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="collections-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.csv"`,
    },
  });
}
