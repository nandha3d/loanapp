import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  try {
    const group = await prisma.chitGroup.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        ...scopedBranchWhere(ctx),
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!group) return fail('Chit group not found', 404);

    const subscriptions = await prisma.chitSubscription.findMany({
      where: { member: { chitGroupId: id, chitGroup: { tenantId: ctx.tenantId, appType: ctx.appType } } },
      include: {
        member: {
          include: {
            customer: { select: { id: true, customerCode: true, name: true } },
          },
        },
      },
      orderBy: [{ periodNumber: 'asc' }, { member: { memberNumber: 'asc' } }],
    });
    return ok(subscriptions);
  } catch (e: any) {
    return fail(e?.message ?? 'Subscriptions failed', 500);
  }
}
