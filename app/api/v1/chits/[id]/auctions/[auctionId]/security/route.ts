import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { getSecurityTypeSpec } from '@/lib/chits/securityTypes';

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
        chitGroup: { tenantId: ctx.tenantId, appType: 'chitfunds', ...scopedBranchWhere(ctx), deletedAt: null },
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
        chitGroup: { tenantId: ctx.tenantId, appType: 'chitfunds', ...scopedBranchWhere(ctx), deletedAt: null },
      },
      include: { chitGroup: true },
    });
    if (!auction || !auction.winnerMemberId) return fail('Auction winner is required before security', 400);
    const guarantorMemberId = body?.guarantorMemberId ? String(body.guarantorMemberId) : undefined;
    if (guarantorMemberId) {
      if (guarantorMemberId === auction.winnerMemberId) {
        return fail('Winner cannot stand as their own internal guarantor', 400);
      }
      const gMem = await prisma.chitMember.findFirst({
        where: { id: guarantorMemberId, chitGroupId: id },
        select: { id: true },
      });
      if (!gMem) return fail('Selected guarantor member does not belong to this chit group', 400);
    }

    const saved = await prisma.$transaction(async (tx) => {
      const existing = await tx.chitSecurity.findFirst({ where: { auctionId } });
      const resolvedSecurityType = body?.securityType ?? existing?.securityType ?? 'INTERNAL_GUARANTOR_JAMEEN';
      const spec = getSecurityTypeSpec(resolvedSecurityType);
      const data: any = {
        securityType: resolvedSecurityType,
        securityValue: spec.showValue
          ? (body?.securityValue == null ? existing?.securityValue ?? null : Number(body.securityValue))
          : null,
        guarantorMemberId: spec.showGuarantorMember
          ? (guarantorMemberId !== undefined ? guarantorMemberId : existing?.guarantorMemberId ?? null)
          : null,
        guarantorName: spec.showPartyName
          ? (body?.guarantorName !== undefined ? body.guarantorName : existing?.guarantorName ?? null)
          : null,
        guarantorPhone: spec.showPartyPhone
          ? (body?.guarantorPhone !== undefined ? body.guarantorPhone : existing?.guarantorPhone ?? null)
          : null,
        details: spec.showDetails
          ? (body?.details !== undefined ? body.details : existing?.details ?? null)
          : null,
        status,
        submittedAt: status === 'submitted' ? new Date() : existing?.submittedAt,
        verifiedById: status === 'verified' ? ctx.userId : existing?.verifiedById,
        verifiedAt: status === 'verified' ? new Date() : existing?.verifiedAt,
        approvedById: status === 'approved' ? ctx.userId : existing?.approvedById,
        approvedAt: status === 'approved' ? new Date() : existing?.approvedAt,
        rejectionReason: status === 'rejected' ? body?.rejectionReason ?? body?.reason ?? null : existing?.rejectionReason,
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
