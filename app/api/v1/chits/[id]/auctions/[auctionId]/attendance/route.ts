import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id, auctionId } = await params;
  const body = await req.json().catch(() => null) as any;
  const memberId = body?.memberId ? String(body.memberId) : '';
  const status = body?.status ?? 'present';
  if (!memberId) return fail('memberId is required', 400);
  if (status === 'proxy' && !body?.proxyName) return fail('proxyName is required for proxy attendance', 400);

  try {
    const auction = await prisma.chitAuction.findFirst({
      where: {
        id: auctionId,
        chitGroupId: id,
        chitGroup: { tenantId: ctx.tenantId, appType: ctx.appType, ...scopedBranchWhere(ctx), deletedAt: null },
      },
      include: { chitGroup: true },
    });
    if (!auction) return fail('Auction not found', 404);
    const member = await prisma.chitMember.findFirst({ where: { id: memberId, chitGroupId: id } });
    if (!member) return fail('Member not found', 404);
    const attendance = await prisma.chitAuctionAttendance.upsert({
      where: { auctionId_memberId: { auctionId, memberId } },
      create: {
        tenantId: ctx.tenantId,
        branchId: auction.chitGroup.branchId,
        auctionId,
        memberId,
        status,
        proxyName: body?.proxyName ?? null,
        remarks: body?.remarks ?? null,
        markedById: ctx.userId,
      },
      update: {
        status,
        proxyName: body?.proxyName ?? null,
        remarks: body?.remarks ?? null,
        markedById: ctx.userId,
        markedAt: new Date(),
      },
    });
    return ok(attendance);
  } catch (e: any) {
    return fail(e?.message ?? 'Attendance failed', 500);
  }
}
