import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id, auctionId } = await params;
  try {
    const auction = await prisma.chitAuction.findFirst({
      where: {
        id: auctionId,
        chitGroupId: id,
        chitGroup: { tenantId: ctx.tenantId, appType: ctx.appType, ...scopedBranchWhere(ctx), deletedAt: null },
      },
    });
    if (!auction) return fail('Auction not found', 404);
    const securities = await prisma.chitSecurity.findMany({ where: { auctionId }, orderBy: { updatedAt: 'desc' } });
    return ok(securities);
  } catch (e: any) {
    return fail(e?.message ?? 'Security load failed', 500);
  }
}

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
  const action = body?.action as string | undefined;
  const status = action === 'verify' ? 'verified' : action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : body?.status ?? 'submitted';
  if ((status === 'approved' || status === 'rejected') && !['superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);

  try {
    const auction = await prisma.chitAuction.findFirst({
      where: {
        id: auctionId,
        chitGroupId: id,
        chitGroup: { tenantId: ctx.tenantId, appType: ctx.appType, ...scopedBranchWhere(ctx), deletedAt: null },
      },
      include: { chitGroup: true },
    });
    if (!auction || !auction.winnerMemberId) return fail('Auction winner is required before security', 400);
    const saved = await prisma.$transaction(async (tx) => {
      const existing = await tx.chitSecurity.findFirst({ where: { auctionId } });
      const data: any = {
        securityType: body?.securityType ?? existing?.securityType ?? 'guarantor',
        securityValue: body?.securityValue == null ? existing?.securityValue : Number(body.securityValue),
        guarantorName: body?.guarantorName ?? existing?.guarantorName,
        guarantorPhone: body?.guarantorPhone ?? existing?.guarantorPhone,
        details: body?.details ?? existing?.details,
        status,
        submittedAt: status === 'submitted' ? new Date() : existing?.submittedAt,
        verifiedById: status === 'verified' ? ctx.userId : existing?.verifiedById,
        verifiedAt: status === 'verified' ? new Date() : existing?.verifiedAt,
        approvedById: status === 'approved' ? ctx.userId : existing?.approvedById,
        approvedAt: status === 'approved' ? new Date() : existing?.approvedAt,
        rejectionReason: status === 'rejected' ? body?.rejectionReason ?? null : existing?.rejectionReason,
      };
      const security = existing
        ? await tx.chitSecurity.update({ where: { id: existing.id }, data })
        : await tx.chitSecurity.create({
            data: {
              tenantId: ctx.tenantId,
              branchId: auction.chitGroup.branchId,
              chitGroupId: id,
              auctionId,
              winnerMemberId: auction.winnerMemberId as string,
              ...data,
            },
          });
      if (status === 'approved') {
        await tx.chitAuction.update({ where: { id: auctionId }, data: { payoutStatus: 'ready' } });
      }
      return security;
    });
    return ok(saved);
  } catch (e: any) {
    return fail(e?.message ?? 'Security update failed', 500);
  }
}
