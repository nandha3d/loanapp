import { NextRequest } from 'next/server';
import { compare } from 'bcryptjs';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const { id } = await params;

  try {
    const body = await req.json();
    const amount = body.amount !== undefined ? Number(body.amount) : undefined;
    const reason = body.reason ? String(body.reason).trim() : '';

    let managerUserId: string | undefined;

    // Manager sign-off check
    if (ctx.role === 'agent') {
      const { managerUsername, managerPassword } = body;
      if (!managerUsername || !managerPassword) {
        return fail('Manager credentials are required for agent sign-off', 400);
      }

      const manager = await prisma.user.findFirst({
        where: {
          username: String(managerUsername).trim().toLowerCase(),
          tenantId: ctx.tenantId,
          role: { in: ['admin', 'superadmin', 'developer'] },
          status: 'active',
        },
      });

      if (!manager || !manager.passwordHash) {
        return fail('Invalid manager credentials', 401);
      }

      const valid = await compare(managerPassword, manager.passwordHash);
      if (!valid) {
        return fail('Invalid manager credentials', 401);
      }

      managerUserId = manager.id;
    }

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

    const gross = Number(penalty.grossPenalty);
    const existingSettled = Number(penalty.settledAmount);
    const existingWaived = Number(penalty.waivedAmount);
    const outstanding = gross - existingSettled - existingWaived;

    const waiveAmt = amount !== undefined ? amount : outstanding;
    if (waiveAmt <= 0 || waiveAmt > outstanding) {
      return fail(`Invalid waive amount. Outstanding is ${outstanding}`, 400);
    }

    const newWaivedAmount = existingWaived + waiveAmt;
    const isFullyWaived = (existingSettled + newWaivedAmount) >= gross;
    const newStatus = isFullyWaived ? 'waived' : 'partial';

    const data: any = {
      waivedAmount: newWaivedAmount,
      status: newStatus,
      settledById: managerUserId || ctx.userId,
      settledAt: new Date(),
      notes: reason || null,
    };

    const updated = await prisma.penalty.update({
      where: { id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'waive',
        entityType: 'penalty',
        entityId: id,
        newValue: JSON.stringify({
          waivedAmount: waiveAmt,
          reason,
          managerSignedOff: !!managerUserId,
        }),
      },
    });

    return ok(updated);
  } catch (e: any) {
    return fail(e?.message ?? 'Waive failed', 500);
  }
}
