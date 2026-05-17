import { NextResponse } from 'next/server';
import { getDefaultTenantId } from '@/lib/tenant';
import prisma from '@/lib/db';
import { normalizeModuleList } from '@/types/modules';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  let tenantId = null;
  try { tenantId = await getDefaultTenantId(); } catch(e) {}
  
  let enabledModules: string[] = [];
  let sub = null;
  if (tenantId) {
    sub = await prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { enabledModules: true },
    });
    enabledModules = normalizeModuleList(sub?.enabledModules);
  }
  
  return NextResponse.json({
    role,
    tenantId,
    subEnabledModules: sub?.enabledModules,
    normalized: enabledModules
  });
}
