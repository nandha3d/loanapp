import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireBorrowerMobileContext } from '@/lib/api/borrower-mobile';
import { reallocateLoanRepayments } from '@/lib/repayments';

async function getOrCreateDailyCollectionForBorrower(
  tx: any,
  tenantId: string,
  appType: string,
  agentId: string,
  branchId: string | null,
  routeId: string | null,
) {
  const d = new Date();
  const today = new Date(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00.000Z`);
  const daily = await tx.dailyCollection.upsert({
    where: {
      tenantId_appType_agentId_date: {
        tenantId,
        appType,
        agentId,
        date: today,
      },
    },
    update: {},
    create: {
      tenantId,
      appType,
      agentId,
      branchId: branchId ?? null,
      routeId: routeId ?? null,
      date: today,
      totalExpected: 0,
      totalCollected: 0,
      entriesCount: 0,
      status: 'open',
    },
    select: { id: true },
  });
  return daily.id;
}

export async function POST(req: NextRequest) {
  const borrower = await requireBorrowerMobileContext(req);
  if (!borrower) return fail('Unauthorized', 401);

  const body = (await req.json().catch(() => null)) as
    | {
        loanId?: string;
        amount?: number | string;
        paymentMode?: string;
        referenceNumber?: string;
        proofPhotoUrl?: string;
      }
    | null;
  const loanId = body?.loanId || borrower.loanId;
  const amount = Number(body?.amount);
  const paymentMode = String(body?.paymentMode || 'upi');
  if (!loanId) return fail('loanId is required', 400);
  if (!Number.isFinite(amount) || amount <= 0) return fail('Invalid repayment amount', 400);

  try {
    const loan = await prisma.loan.findFirst({
      where: {
        id: loanId,
        tenantId: borrower.tenantId,
        customerId: borrower.customerId,
        status: { in: ['active', 'overdue'] },
        deletedAt: null,
      },
      include: {
        customer: { select: { id: true, name: true, agentId: true, routeId: true } },
        instalments: { orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }] },
      },
    });
    if (!loan) return fail('Active loan not found', 404);

    let agentId = loan.customer.agentId;
    if (!agentId) {
      const fallbackUser = await prisma.user.findFirst({
        where: { tenantId: borrower.tenantId, status: 'active' },
        select: { id: true },
      });
      if (!fallbackUser) return fail('No active user found for borrower payment mapping', 500);
      agentId = fallbackUser.id;
    }

    const result = await prisma.$transaction(async (tx) => {
      const unpaidInstalments = await tx.instalment.findMany({
        where: {
          loanId,
          status: { in: ['upcoming', 'missed', 'partial'] },
        },
        orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
      });
      if (unpaidInstalments.length === 0) {
        throw new Error('All instalments for this loan have already been fully collected.');
      }

      const payment = await tx.payment.create({
        data: {
          tenantId: borrower.tenantId,
          loanId,
          amount,
          paymentMode,
          referenceNumber: body?.referenceNumber || null,
          paymentDate: new Date(),
          status: 'completed',
        },
      });

      const dailyCollectionId = await getOrCreateDailyCollectionForBorrower(
        tx,
        borrower.tenantId,
        loan.appType,
        agentId!,
        loan.branchId,
        loan.customer.routeId,
      );

      let remaining = amount;
      for (const inst of unpaidInstalments) {
        if (remaining <= 0) break;
        const due = Number(inst.dueAmount);
        const received = Number(inst.receivedAmount || 0);
        const outstanding = Math.max(0, due - received);
        if (outstanding <= 0) continue;

        const allocatedAmount = Math.min(remaining, outstanding);
        remaining = Number((remaining - allocatedAmount).toFixed(2));

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            instalmentId: inst.id,
            amount: allocatedAmount,
          },
        });

        const nextReceived = Number((received + allocatedAmount).toFixed(2));
        await tx.instalment.update({
          where: { id: inst.id },
          data: {
            receivedAmount: nextReceived,
            status: nextReceived >= due ? 'paid' : 'partial',
            receivedAt: new Date(),
            remarks: `Self-Service Payment (${paymentMode})`,
          },
        });

        await tx.collectionEntry.create({
          data: {
            id: randomUUID(),
            collectionId: dailyCollectionId,
            customerId: loan.customerId,
            loanId: loan.id,
            dueAmount: due,
            receivedAmount: allocatedAmount,
            paymentMode,
            remarks: [
              `Self-Service Repayment | Payment ID: ${payment.id}`,
              body?.proofPhotoUrl ? `Proof: ${body.proofPhotoUrl}` : null,
            ].filter(Boolean).join(' | '),
            agentId: agentId!,
            submittedAt: new Date(),
            isLocked: true,
            verificationStatus: paymentMode === 'cash' ? 'pending' : 'verified',
            source: 'self_pay_upi',
            tenantId: borrower.tenantId,
          },
        });
      }

      await reallocateLoanRepayments(tx, loanId);

      const allEntries = await tx.collectionEntry.findMany({
        where: { collectionId: dailyCollectionId },
      });
      await tx.dailyCollection.update({
        where: { id: dailyCollectionId },
        data: {
          totalCollected: allEntries.reduce((sum, entry) => sum + Number(entry.receivedAmount), 0),
          totalExpected: allEntries.reduce((sum, entry) => sum + Number(entry.dueAmount), 0),
          entriesCount: allEntries.length,
        },
      });

      return { paymentId: payment.id, allocated: amount - remaining };
    });

    return ok({ success: true, ...result });
  } catch (e: any) {
    return fail(e?.message ?? 'Borrower payment failed', 500);
  }
}
