import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import prisma from '@/lib/db';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || '';

  const expectedToken = Buffer.from(cronSecret);
  const providedTokenStr = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';
  const providedToken = Buffer.from(providedTokenStr);

  if (!cronSecret || expectedToken.length !== providedToken.length || !crypto.timingSafeEqual(expectedToken, providedToken)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
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
