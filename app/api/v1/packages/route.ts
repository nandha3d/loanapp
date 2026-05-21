import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const packages = await prisma.loanPackage.findMany({
      where: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
    });
    return ok(packages);
  } catch (e: any) {
    return fail(e?.message ?? 'Packages failed', 500);
  }
}
