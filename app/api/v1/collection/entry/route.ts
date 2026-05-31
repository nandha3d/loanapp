import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';
import { reallocateLoanRepayments } from '@/lib/repayments';
import { buildCollectionIdempotencyKey, getCollectionSubmissionBlockReason } from '@/lib/collectionPolicy';
import {
  isGpsTrackingEnabled,
  normalizeGpsBody,
  recordCollectionLocationPing,
  verifyAndPersistCollectionLocation,
} from '@/lib/gps/locationVerifier';

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
    const gpsTrackingEnabled = await isGpsTrackingEnabled(ctx.tenantId);
    const gpsCapture = normalizeGpsBody(body, gpsTrackingEnabled);
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

      // Distribute the collected amount across the loan's unpaid instalments
      // OLDEST-FIRST (clears overdue before today's due) instead of capping to
      // the clicked instalment and discarding the surplus. Parity with the web
      // collection action.
      const unpaid = await tx.instalment.findMany({
        where: { loanId: instalment.loanId },
        orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
        select: { id: true, dueAmount: true, receivedAmount: true },
      });
      let remaining = receivedAmount;
      const plan: { id: string; add: number }[] = [];
      for (const inst of unpaid) {
        if (remaining <= 0) break;
        const room = Math.max(0, Number(inst.dueAmount) - Number(inst.receivedAmount || 0));
        if (room <= 0) continue;
        const add = Math.min(remaining, room);
        plan.push({ id: inst.id, add });
        remaining -= add;
      }
      const applied = plan.reduce((s, p) => s + p.add, 0);
      if (applied <= 0) throw new Error('already_paid: fully collected');

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
          lat: gpsCapture.latitude,
          lng: gpsCapture.longitude,
          gpsAccuracyM: gpsCapture.gpsAccuracy,
          gpsCapturedAt: gpsCapture.gpsTimestamp,
          gpsAltitude: gpsCapture.gpsAltitude,
          locationStatus: gpsCapture.locationStatus,
        },
      });

      // One Payment with a PaymentAllocation per instalment it covers.
      const payment = await tx.payment.create({
        data: {
          tenantId: ctx.tenantId,
          loanId: instalment.loanId,
          amount: applied,
          paymentMode,
          paymentDate: new Date(),
          status: 'completed',
        },
      });
      for (const p of plan) {
        await tx.paymentAllocation.create({
          data: { paymentId: payment.id, instalmentId: p.id, amount: p.add },
        });
        await tx.instalment.update({
          where: { id: p.id },
          data: { receivedAmount: { increment: p.add }, receivedAt: new Date() },
        });
      }

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

    if (gpsTrackingEnabled) {
      try {
        await Promise.all([
          verifyAndPersistCollectionLocation({
            entryId: entry.id,
            tenantId: ctx.tenantId,
            customerId: instalment.loan.customerId,
            latitude: gpsCapture.latitude,
            longitude: gpsCapture.longitude,
          }),
          recordCollectionLocationPing({
            tenantId: ctx.tenantId,
            agentId: ctx.userId,
            branchId: instalment.loan.branchId ?? null,
            capture: gpsCapture,
          }),
        ]);
      } catch (error) {
        console.error('GPS verification failed:', error);
      }
    }

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
