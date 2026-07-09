import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

function statusFromAction(action: string | undefined) {
  if (action === 'verify') return 'verified';
  if (action === 'approve') return 'approved';
  if (action === 'reject') return 'rejected';
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string; documentId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id, auctionId, documentId } = await params;
  const body = await req.json().catch(() => null) as any;
  const status = statusFromAction(typeof body?.action === 'string' ? body.action : undefined);
  if (!status) return fail('Invalid document review action', 400);
  if ((status === 'approved' || status === 'rejected') && !['superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);

  try {
    const auction = await prisma.chitAuction.findFirst({
      where: {
        id: auctionId,
        chitGroupId: id,
        chitGroup: {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          ...scopedBranchWhere(ctx),
          deletedAt: null,
        },
      },
    });
    if (!auction) return fail('Auction not found', 404);
    const security = await prisma.chitSecurity.findFirst({
      where: {
        tenantId: ctx.tenantId,
        chitGroupId: id,
        auctionId,
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!security) return fail('Security record not found', 404);
    const document = await prisma.chitDocument.findFirst({
      where: {
        id: documentId,
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        entityType: 'chit_security',
        entityId: security.id,
      },
    });
    if (!document) return fail('Security document not found', 404);
    const updated = await prisma.chitDocument.update({
      where: { id: document.id },
      data: { status },
    });
    return ok(updated);
  } catch (e: any) {
    return fail(e?.message ?? 'Security document review failed', 500);
  }
}
