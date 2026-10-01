import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
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
        where: {
          id: entryId,
          tenantId: ctx.tenantId,
          loan: { appType: ctx.appType, ...scopedBranchWhere(ctx) },
        },
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
            appType: ctx.appType,
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
        appType: ctx.appType,
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
          loan: { appType: ctx.appType, ...scopedBranchWhere(ctx) },
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
              appType: ctx.appType,
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
      return fail('Use the wallet handover flow', 410);
    }

    return fail('Invalid action', 400);
  } catch (e: any) {
    console.error('[/api/v1/collection/verify POST]', e);
    return fail(e?.message ?? 'Verification failed', 500);
  }
}
