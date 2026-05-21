import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';
import { recordPaymentLedger } from '@/lib/paymentService';
import { reallocateLoanRepayments } from '@/lib/repayments';
import { buildCollectionIdempotencyKey, getCollectionSubmissionBlockReason } from '@/lib/collectionPolicy';

function parseDay(value: string | null) {
  const d = value ? new Date(value) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Mobile collection submit. Body: `{instalmentId, receivedAmount, paymentMode,
 * remarks?, idempotencyKey?}`. Honors a client-supplied idempotency key
 * (format: `collectionDate:instalmentId`) so retries are safe (spec §6.2).
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const body = await req.json();
    const instalmentId = String(body.instalmentId || '');
    const receivedAmount = Number(body.receivedAmount);
    const paymentMode = String(body.paymentMode || 'cash');
    const remarks = body.remarks ? String(body.remarks) : null;
    if (!instalmentId || isNaN(receivedAmount) || receivedAmount <= 0) {
      return fail('Invalid amount', 400);
    }

    const instalment = await prisma.instalment.findUnique({
      where: { id: instalmentId },
      include: { loan: { include: { customer: true } } },
    });
    if (
      !instalment ||
      instalment.loan.tenantId !== ctx.tenantId ||
      instalment.loan.appType !== ctx.appType
    ) {
      return fail('Instalment not found', 404);
    }
    const block = getCollectionSubmissionBlockReason({
      loanStatus: instalment.loan.status,
      dueAmount: Number(instalment.dueAmount),
      receivedAmount: Number(instalment.receivedAmount || 0),
    });
    if (block) return fail(`already_paid: ${block}`, 409);

    if (ctx.role === 'agent') {
      const routeIds = await getAgentRouteIds(ctx.userId);
      const cRouteId = instalment.loan.customer.routeId;
      if (!cRouteId || !routeIds.includes(cRouteId)) {
        return fail('Forbidden', 403);
      }
    }

    const today = parseDay(body.collectionDate ?? null);
    const idempotencyKey =
      (body.idempotencyKey as string | undefined) ??
      buildCollectionIdempotencyKey({
        tenantId: ctx.tenantId,
        agentId: ctx.userId,
        instalmentId,
        receivedAmount,
        paymentMode,
        collectionDate: today,
      });

    const entry = await prisma.$transaction(async (tx) => {
      // Check idempotency first.
      const existing = await tx.collectionEntry.findFirst({
        where: { idempotencyKey, tenantId: ctx.tenantId },
      });
      if (existing) return existing;

      let dailyCollection = await tx.dailyCollection.findFirst({
        where: {
          agentId: ctx.userId,
          date: today,
          tenantId: ctx.tenantId,
          appType: ctx.appType,
        },
      });
      if (!dailyCollection) {
        dailyCollection = await tx.dailyCollection.create({
          data: {
            tenantId: ctx.tenantId,
            branchId: instalment.loan.branchId,
            agentId: ctx.userId,
            routeId: instalment.loan.customer.routeId,
            date: today,
            totalExpected: 0,
            totalCollected: 0,
            entriesCount: 0,
            appType: ctx.appType,
            status: 'open',
          },
        });
      }

      const dueRemaining =
        Number(instalment.dueAmount) - Number(instalment.receivedAmount || 0);
      const applied = Math.min(receivedAmount, dueRemaining);

      const created = await tx.collectionEntry.create({
        data: {
          tenantId: ctx.tenantId,
          idempotencyKey,
          collectionId: dailyCollection.id,
          customerId: instalment.loan.customerId,
          loanId: instalment.loanId,
          dueAmount: Number(instalment.dueAmount),
          receivedAmount: applied,
          paymentMode,
          remarks,
          agentId: ctx.userId,
        },
      });

      await recordPaymentLedger(tx, {
        tenantId: ctx.tenantId,
        loanId: instalment.loanId,
        instalmentId: instalment.id,
        amount: applied,
        paymentMode,
      });

      await tx.instalment.update({
        where: { id: instalment.id },
        data: {
          receivedAmount: { increment: applied },
          receivedAt: new Date(),
        },
      });

      await reallocateLoanRepayments(tx, instalment.loanId);

      const all = await tx.collectionEntry.findMany({
        where: { collectionId: dailyCollection.id },
      });
      await tx.dailyCollection.update({
        where: { id: dailyCollection.id },
        data: {
          totalCollected: all.reduce((s, e) => s + Number(e.receivedAmount), 0),
          totalExpected: all.reduce((s, e) => s + Number(e.dueAmount), 0),
          entriesCount: all.length,
        },
      });

      return created;
    });

    return ok(entry);
  } catch (e: any) {
    if (
      e?.code === 'P2002' ||
      /duplicate|unique|already/i.test(String(e?.message))
    ) {
      return fail('already_paid', 409);
    }
    return fail(e?.message ?? 'Collection failed', 500);
  }
}
