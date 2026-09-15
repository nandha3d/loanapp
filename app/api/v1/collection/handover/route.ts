import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const dailyCollection = await prisma.dailyCollection.findFirst({
      where: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        agentId: ctx.userId,
        date: today,
      },
    });

    if (!dailyCollection || Number(dailyCollection.totalCollected) <= 0) {
      return fail('No collections to handover today', 400);
    }

    if (dailyCollection.status !== 'open') {
      return fail('Handover already requested or settled', 400);
    }

    await prisma.$transaction([
      prisma.dailyCollection.update({
        where: { id: dailyCollection.id },
        data: { status: 'pending_handover' }
      }),
      prisma.approvalRequest.create({
        data: {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          requestType: 'cash_handover',
          entityType: 'daily_collection',
          entityId: dailyCollection.id,
          requestedById: ctx.userId,
          requestedChanges: JSON.stringify({ amount: Number(dailyCollection.totalCollected) }),
          reason: 'End of day cash handover',
          status: 'pending'
        }
      })
    ]);

    const agent = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true, branchId: true } });
    const { notifyApprovers } = await import('@/lib/notify/approvers');
    const { modulePath } = await import('@/types/modules');
    await notifyApprovers({
      tenantId: ctx.tenantId,
      branchId: agent?.branchId ?? ctx.branchId,
      requesterBranchId: ctx.branchId,
      requesterRole: ctx.role,
      appType: ctx.appType,
      type: 'cash_handover',
      icon: 'payments',
      title: 'Cash handover to collect',
      message: `${agent?.name ?? 'An agent'} requested end-of-day handover of ₹${Number(dailyCollection.totalCollected).toLocaleString('en-IN')}.`,
      link: modulePath(ctx.appType, '/approvals'),
    });

    return ok({ success: true });
  } catch (e: any) {
    console.error('[/api/v1/collection/handover POST]', e);
    return fail(e?.message ?? 'Handover request failed', 500);
  }
}
