import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }
  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const note = body.note ? String(body.note) : null;

    const existing = await prisma.approvalRequest.findUnique({ where: { id } });
    if (
      !existing ||
      existing.tenantId !== ctx.tenantId ||
      existing.appType !== ctx.appType
    ) {
      return fail('Approval not found', 404);
    }

    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewedById: ctx.userId,
        reviewNote: note,
        reviewedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'rejected',
        entityType: 'approval',
        entityId: id,
        newValue: JSON.stringify({ note }),
      },
    });

    return ok(updated);
  } catch (e: any) {
    return fail(e?.message ?? 'Review failed', 500);
  }
}
