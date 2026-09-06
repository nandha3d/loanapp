import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail , failFromError} from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const group = await prisma.chitGroup.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
        appType: 'chitfunds',
        ...scopedBranchWhere(ctx),
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!group) return fail('Chit group not found', 404);

    const updated = await prisma.chitGroup.update({
      where: { id },
      data: { status: 'cancelled', complianceStatus: 'suspended' },
    });
    return ok(updated);
  } catch (e: any) {
    return failFromError(e, 'Chit cancel failed');
  }
}
