import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find subscriptions that are past due and grace period has ended
  const pastDueSubscriptions = await prisma.tenantSubscription.findMany({
    where: {
      status: 'past_due',
      gracePeriodEnd: {
        lt: new Date(),
      },
      tenant: {
        status: { not: 'suspended' },
      },
    },
    include: {
      tenant: true,
    },
  });

  let suspendedCount = 0;

  for (const sub of pastDueSubscriptions) {
    await prisma.$transaction(async (tx) => {
      // Suspend tenant
      await tx.tenant.update({
        where: { id: sub.tenantId },
        data: { status: 'suspended' },
      });

      // We should ideally send an email/notification here
      // e.g. sendSystemNotification(sub.tenantId, 'tenant_suspended')

      suspendedCount++;
    });
  }

  return NextResponse.json({
    ok: true,
    processed: pastDueSubscriptions.length,
    suspended: suspendedCount,
  });
}
