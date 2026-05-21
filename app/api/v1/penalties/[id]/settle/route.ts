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
    const body = await req.json();
    const action = String(body.action || 'settle'); // settle | waive
    const amount = Number(body.amount ?? 0);
    const paymentMode = String(body.paymentMode || 'cash');

    const penalty = await prisma.penalty.findUnique({
      where: { id },
      include: { loan: true },
    });
    if (
      !penalty ||
      penalty.loan.tenantId !== ctx.tenantId ||
      penalty.loan.appType !== ctx.appType
    ) {
      return fail('Penalty not found', 404);
    }

    const data: any = { status: action === 'waive' ? 'waived' : 'settled' };
    if (action === 'waive') {
      data.waivedAmount = Number(penalty.grossPenalty);
    } else {
      data.settledAmount = amount || Number(penalty.grossPenalty);
      data.paymentMode = paymentMode;
      data.settledAt = new Date();
    }

    const updated = await prisma.penalty.update({ where: { id }, data });

    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: action === 'waive' ? 'waive' : 'settle',
        entityType: 'penalty',
        entityId: id,
        newValue: JSON.stringify(data),
      },
    });

    return ok(updated);
  } catch (e: any) {
    return fail(e?.message ?? 'Settle failed', 500);
  }
}
