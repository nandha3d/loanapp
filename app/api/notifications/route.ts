import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ count: 0 }, { status: 401 });

    const tenantId = await getDefaultTenantId();
    const appType = await getUserAppType();
    const count = await prisma.systemNotification.count({
      where: { tenantId, appType, isRead: false },
    });
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
