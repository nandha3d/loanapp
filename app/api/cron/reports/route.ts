import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import prisma from '@/lib/db';
import { formatCurrency } from '@/lib/utils';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || '';

  const expectedToken = Buffer.from(cronSecret);
  const providedTokenStr = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';
  const providedToken = Buffer.from(providedTokenStr);

  if (!cronSecret || expectedToken.length !== providedToken.length || !crypto.timingSafeEqual(expectedToken, providedToken)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Get all active tenants
  const tenants = await prisma.tenant.findMany({ where: { status: 'active' } });

  for (const tenant of tenants) {
    // Calculate yesterday's collection
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const stats = await prisma.collectionEntry.aggregate({
      where: {
        tenantId: tenant.id,
        submittedAt: { gte: yesterday, lte: endOfYesterday },
      },
      _sum: { receivedAmount: true },
      _count: { id: true },
    });

    const totalCollected = Number(stats._sum.receivedAmount || 0);
    const count = stats._count.id;

    // Send Daily Email (Mocked)
    console.log(`[REPORT] Tenant: ${tenant.name} | Date: ${yesterday.toDateString()} | Total: ${formatCurrency(totalCollected)} | Count: ${count}`);
    
    // In a real implementation:
    // await sendEmail(tenant.adminEmail, 'Daily Collection Report', `...`);
  }

  return NextResponse.json({ success: true, processed: tenants.length });
}
