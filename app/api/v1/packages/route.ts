import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { branchOrSharedWhere } from '@/lib/masterDataScope';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const packages = await prisma.loanPackage.findMany({
      // A branch's own products plus any published tenant-wide (branchId null).
      where: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        status: 'active',
        ...branchOrSharedWhere(ctx.branchId),
      },
      orderBy: { createdAt: 'desc' },
    });
    return ok(packages);
  } catch (e: any) {
    return fail(e?.message ?? 'Packages failed', 500);
  }
}
