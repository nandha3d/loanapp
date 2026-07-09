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

    const members = await prisma.chitMember.findMany({
      where: { chitGroupId: id },
      include: {
        customer: { select: { id: true, customerCode: true, name: true, phone: true, profilePhoto: true } },
        subscriptions: { orderBy: { periodNumber: 'asc' } },
      },
      orderBy: { memberNumber: 'asc' },
    });
    return ok(members);
  } catch (e: any) {
    return fail(e?.message ?? 'Members failed', 500);
  }
}
