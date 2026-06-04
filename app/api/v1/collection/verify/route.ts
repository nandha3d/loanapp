import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { autoPostCollection } from '@/lib/accounting/autoPost';

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const { action, entryId, entryIds, routeId, agentId } = body;

    if (action === 'upi') {
      const entry = await prisma.collectionEntry.findFirst({
        where: { id: entryId, tenantId: ctx.tenantId },
        include: { loan: true }
      });
      if (!entry) return fail('Entry not found', 404);
      if (entry.verificationStatus === 'verified') return ok({ message: 'Already verified' });

      await prisma.$transaction(async (tx) => {
        await tx.collectionEntry.update({
          where: { id: entry.id },
          data: { verificationStatus: 'verified' }
        });

        await tx.accountEntry.create({
          data: {
            tenantId: ctx.tenantId,
            entryDate: new Date(),
            type: 'collection',
            category: 'upi',
            amount: entry.receivedAmount,
            description: `Verified UPI collection for loan ${entry.loan.loanCode}`,
            referenceId: entry.id,
            referenceType: 'payment',
            createdBy: ctx.userId,
            branchId: entry.loan.branchId,
          }
        });
      });

      autoPostCollection({
        tenantId: ctx.tenantId,
        entryId: entry.id,
        loanId: entry.loanId,
        loanCode: entry.loan.loanCode,
        amount: Number(entry.receivedAmount),
        date: new Date(),
        branchId: entry.loan.branchId,
        createdById: ctx.userId,
        paymentMode: 'upi',
      }).catch(() => {});

      return ok({ success: true });
    }

    if (action === 'bulk-upi') {
      if (!Array.isArray(entryIds) || !entryIds.length) {
        return fail('No entryIds selected', 400);
      }
      const entries = await prisma.collectionEntry.findMany({
        where: {
          id: { in: entryIds },
          tenantId: ctx.tenantId,
          paymentMode: 'upi',
          verificationStatus: 'pending',
        },
        include: { loan: true },
      });

      if (entries.length === 0) return fail('No pending UPI entries found', 404);

      await prisma.$transaction(async (tx) => {
        await tx.collectionEntry.updateMany({
          where: { id: { in: entries.map(e => e.id) } },
          data: { verificationStatus: 'verified' },
        });

        for (const entry of entries) {
          await tx.accountEntry.create({
            data: {
              tenantId: ctx.tenantId,
              entryDate: new Date(),
              type: 'collection',
              category: 'upi',
              amount: entry.receivedAmount,
              description: `Verified UPI collection for loan ${entry.loan.loanCode}`,
              referenceId: entry.id,
              referenceType: 'payment',
              createdBy: ctx.userId,
              branchId: entry.loan.branchId,
            },
          });
        }
      });

      return ok({ success: true, count: entries.length });
    }

    if (action === 'collect-cash') {
      if (!routeId || !agentId) {
        return fail('routeId and agentId are required', 400);
      }

      let handoverTotal = 0;
      let handoverBranchId: string | null = null;

      await prisma.$transaction(async (tx) => {
        const entries = await tx.collectionEntry.findMany({
          where: {
            tenantId: ctx.tenantId,
            agentId,
            paymentMode: 'cash',
            verificationStatus: 'pending',
            customer: { routeId }
          },
          include: { loan: true }
        });

        const totalToCollect = entries.reduce((sum, e) => sum + Number(e.receivedAmount), 0);
        if (totalToCollect <= 0) throw new Error('No pending cash to collect for this route/agent combo');

        const branchId = entries[0]?.loan?.branchId || null;
        handoverTotal = totalToCollect;
        handoverBranchId = branchId;

        await tx.collectionEntry.updateMany({
          where: {
            id: { in: entries.map(e => e.id) }
          },
          data: { verificationStatus: 'verified' }
        });

        const handover = await tx.cashHandover.create({
          data: {
            tenantId: ctx.tenantId,
            agentId,
            adminId: ctx.userId,
            routeId,
            amount: totalToCollect,
            status: 'collected',
            collectedAt: new Date(),
            confirmedAt: new Date()
          }
        });

        await tx.accountEntry.create({
          data: {
            tenantId: ctx.tenantId,
            entryDate: new Date(),
            type: 'collection',
            category: 'cash',
            amount: totalToCollect,
            description: `Cash handover collected`,
            referenceId: handover.id,
            referenceType: 'payment',
            createdBy: ctx.userId,
            branchId,
          }
        });
      });

      if (handoverTotal > 0) {
        autoPostCollection({
          tenantId: ctx.tenantId,
          entryId: `handover-${routeId}-${agentId}-${Date.now()}`,
          loanId: routeId,
          loanCode: `Route/${routeId.slice(0, 8)}`,
          amount: handoverTotal,
          date: new Date(),
          branchId: handoverBranchId,
          createdById: ctx.userId,
          paymentMode: 'cash',
        }).catch(() => {});
      }

      return ok({ success: true });
    }

    return fail('Invalid action', 400);
  } catch (e: any) {
    console.error('[/api/v1/collection/verify POST]', e);
    return fail(e?.message ?? 'Verification failed', 500);
  }
}
