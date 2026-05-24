import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { formatCurrency } from '@/lib/utils';
import { authorizeCron } from '@/lib/cronAuth';

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

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
