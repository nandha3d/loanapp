import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const tenantId = await getDefaultTenantId();
    const count = await prisma.systemNotification.count({
      where: { tenantId, isRead: false },
    });
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
