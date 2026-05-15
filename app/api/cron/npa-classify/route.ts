import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 90 days ago
  const npaThresholdDate = new Date();
  npaThresholdDate.setDate(npaThresholdDate.getDate() - 90);

  // Find loans that have an unpaid instalment due before npaThresholdDate
  // and are not already classified as NPA
  const npaCandidateLoans = await prisma.loan.findMany({
    where: {
      status: 'active',
      npaStatus: null,
      instalments: {
        some: {
          // 'missed' and 'partial' imply receivedAmount < dueAmount by definition;
          // 'upcoming' that is 90+ days overdue has also not been fully paid.
          status: { in: ['missed', 'partial', 'upcoming'] },
          dueDate: { lt: npaThresholdDate },
        },
      },
    },
    select: { id: true, tenantId: true },
  });

  if (npaCandidateLoans.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let classifiedCount = 0;

  for (const loan of npaCandidateLoans) {
    await prisma.$transaction(async (tx) => {
      await tx.loan.update({
        where: { id: loan.id },
        data: {
          npaStatus: 'NPA',
          npaClassifiedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: loan.tenantId,
          userId: 'system',
          action: 'npa_classification',
          entityType: 'loan',
          entityId: loan.id,
        },
      });
      classifiedCount++;
    });
  }

  return NextResponse.json({
    ok: true,
    processed: npaCandidateLoans.length,
    classifiedCount,
  });
}
