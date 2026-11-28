import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { collectChitSubscriptionPayment } from '@/lib/chits/collections';
import { parseChitEngineConfig, resolveEngineTypeFromGroup } from '@/lib/chits/engineTypes';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['agent', 'admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id: chitGroupId } = await params;

  try {
    const body = await req.json();
    const memberId = String(body?.memberId ?? '');
    const periodNumber = Number(body?.periodNumber);
    const amount = Number(body?.amount ?? body?.paidAmount);
    const mode = body?.mode === 'SET_TOTAL_PAID' ? 'SET_TOTAL_PAID' : 'ADD_PAYMENT';
    const paymentMode = String(body?.paymentMode ?? 'cash');
    const idempotencyKey =
      typeof body?.idempotencyKey === 'string' && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim().slice(0, 191)
        : null;
    if (!memberId || !Number.isInteger(periodNumber)) return fail('memberId and periodNumber are required', 400);
    if (!Number.isFinite(amount) || amount <= 0) return fail('amount must be greater than zero', 400);

    const sub = await prisma.chitSubscription.findFirst({
      where: {
        memberId,
        periodNumber,
        member: {
          chitGroupId,
          chitGroup: {
            tenantId: ctx.tenantId,
            appType: 'chitfunds',
            ...scopedBranchWhere(ctx),
            deletedAt: null,
          },
        },
      },
      include: { member: { include: { chitGroup: { include: { branch: true } } } } },
    });
    if (!sub) return fail('Subscription not found', 404);

    if (idempotencyKey) {
      const existingReceipt = await (prisma as any).chitReceipt.findFirst({
        where: {
          tenantId: ctx.tenantId,
          appType: 'chitfunds',
          receiptType: 'collection',
          idempotencyKey,
        },
      });
      if (existingReceipt) {
        if (existingReceipt.entityType !== 'subscription' || existingReceipt.entityId !== sub.id) {
          return fail('Idempotency key already used for another chit payment', 409);
        }
        return ok({
          id: sub.id,
          subscription: sub,
          receiptNo: existingReceipt.receiptNo,
          receivedDelta: Number(existingReceipt.amount),
          status: sub.status,
          idempotent: true,
          idempotentReplay: true,
        });
      }
    }

    if (mode === 'ADD_PAYMENT' && sub.status === 'paid') {
      return fail('Cycle is already fully paid', 409);
    }

    const engineType = resolveEngineTypeFromGroup(sub.member.chitGroup);
    const engineCfg = parseChitEngineConfig(sub.member.chitGroup.engineConfig, engineType);
    const goldRatePerGram =
      body?.goldRatePerGram != null
        ? Number(body.goldRatePerGram)
        : engineCfg.goldScheme?.defaultGoldRatePerGram ?? null;

    const result = await prisma.$transaction(async (tx) => {
      return collectChitSubscriptionPayment(tx, {
        tenantId: ctx.tenantId,
        appType: 'chitfunds',
        branchId: sub.member.chitGroup.branchId,
        branchCode: sub.member.chitGroup.branch?.code,
        subscriptionId: sub.id,
        currentPaidAmount: Number(sub.paidAmount),
        dueAmount: Number(sub.dueAmount),
        amount,
        mode,
        paymentMode,
        referenceNo: body?.referenceNo ?? null,
        idempotencyKey,
        notes: body?.notes ?? body?.note ?? null,
        collectorId: ctx.userId,
        isGoldWeightEngine: engineType === 'GOLD_WEIGHT_ACCUMULATION',
        goldRatePerGram,
        denominationBreakdown: body?.denominationBreakdown ?? body?.cashDenominations ?? null,
      });
    });
    return ok({ id: sub.id, idempotentReplay: false, ...result });
  } catch (e: any) {
    const msg = e?.message ?? 'Chit payment failed';
    const isClientErr =
      msg.includes('denomination') ||
      msg.includes('Cash denomination') ||
      msg.includes('exceeds') ||
      msg.includes('already') ||
      msg.includes('No new collection');
    return fail(msg, isClientErr ? 400 : 500);
  }
}
