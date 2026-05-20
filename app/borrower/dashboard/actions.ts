'use server';

import prisma from '@/lib/db';
import { getBorrowerSession } from '@/lib/borrowerAuth';
import { reallocateLoanRepayments } from '@/lib/repayments';
import { recordPaymentLedger } from '@/lib/paymentService';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

interface RepaymentResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Atomic helper to get or create a DailyCollection for borrower self-service repayments.
 * Maps borrower payments to the customer's assigned agent or a default branch admin
 * so it is tracked correctly in daily ledger summaries.
 */
async function getOrCreateDailyCollectionForBorrower(
  tx: any,
  tenantId: string,
  appType: string,
  agentId: string,
  branchId: string | null,
  routeId: string | null
): Promise<string> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if daily collection already exists for this agent on this date
  const existing = await tx.dailyCollection.findFirst({
    where: {
      tenantId,
      appType,
      agentId,
      date: today,
    },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const newId = randomUUID();
  const created = await tx.dailyCollection.create({
    data: {
      id: newId,
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
  });

  return created.id;
}

/**
 * Server Action: submitBorrowerRepayment
 * Performs a dynamic customer-initiated loan repayment.
 * Mobile friendly - returns pure data responses.
 */
export async function submitBorrowerRepayment(
  amount: number,
  paymentMode: string,
  referenceNumber: string = '',
  customLoanId?: string
): Promise<RepaymentResponse> {
  try {
    // 1. Verify borrower session
    const session = await getBorrowerSession();
    if (!session) {
      return { success: false, error: 'Unauthorized: No active borrower session.' };
    }

    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'Invalid repayment amount.' };
    }

    const { tenantId, customerId } = session;
    const loanId = customLoanId || session.loanId;

    // 2. Fetch the loan and customer details
    const loan = await prisma.loan.findFirst({
      where: {
        id: loanId,
        tenantId,
        customerId,
        status: { in: ['active', 'overdue'] },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            agentId: true,
            routeId: true,
            phone: true,
          },
        },
        instalments: {
          orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
        },
      },
    });

    if (!loan) {
      return { success: false, error: 'Active loan not found.' };
    }

    // 3. Resolve the collector/agent for DailyCollection association.
    // Falls back to a tenant user if no agent is assigned to the customer.
    let agentId = loan.customer.agentId;
    if (!agentId) {
      const fallbackUser = await prisma.user.findFirst({
        where: { tenantId, status: 'active' },
        select: { id: true },
      });
      if (!fallbackUser) {
        return { success: false, error: 'System configuration error: No active user found for mapping.' };
      }
      agentId = fallbackUser.id;
    }

    // 4. Begin atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Find all unpaid or partially paid instalments
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

      // Create a master Payment record
      const payment = await tx.payment.create({
        data: {
          tenantId,
          loanId,
          amount,
          paymentMode,
          referenceNumber: referenceNumber || null,
          paymentDate: new Date(),
          status: 'completed',
        },
      });

      // Get or create DailyCollection
      const dailyCollectionId = await getOrCreateDailyCollectionForBorrower(
        tx,
        tenantId,
        loan.appType,
        agentId!,
        loan.branchId,
        loan.customer.routeId
      );

      let remaining = amount;
      const allocationsDesc: string[] = [];

      for (const inst of unpaidInstalments) {
        if (remaining <= 0) break;

        const due = Number(inst.dueAmount);
        const received = Number(inst.receivedAmount || 0);
        const outstanding = Math.max(0, due - received);

        if (outstanding <= 0) continue;

        const allocatedAmount = Math.min(remaining, outstanding);
        remaining = Number((remaining - allocatedAmount).toFixed(2));

        // Create PaymentAllocation record
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            instalmentId: inst.id,
            amount: allocatedAmount,
          },
        });

        // Update the Instalment record
        const nextReceived = Number((received + allocatedAmount).toFixed(2));
        const isPaid = nextReceived >= due;

        await tx.instalment.update({
          where: { id: inst.id },
          data: {
            receivedAmount: nextReceived,
            status: isPaid ? 'paid' : 'partial',
            receivedAt: new Date(),
            remarks: `Self-Service Payment (${paymentMode})`,
          },
        });

        // Create a CollectionEntry for compatibility with daily ledger
        const entryId = randomUUID();
        await tx.collectionEntry.create({
          data: {
            id: entryId,
            collectionId: dailyCollectionId,
            customerId: loan.customerId,
            loanId: loan.id,
            dueAmount: due,
            receivedAmount: allocatedAmount,
            paymentMode,
            remarks: `Self-Service Repayment | Payment ID: ${payment.id}`,
            agentId: agentId!,
            submittedAt: new Date(),
            isLocked: true,
            verificationStatus: paymentMode === 'cash' ? 'pending' : 'verified', // UPI and cards verified automatically
            tenantId,
          },
        });

        allocationsDesc.push(`#${inst.instalmentNo} (+₹${allocatedAmount})`);
      }

      // 5. Recalculate and reallocate loan totals
      await reallocateLoanRepayments(tx, loanId);

      // 6. Update DailyCollection expected vs collected totals
      const allEntries = await tx.collectionEntry.findMany({
        where: { collectionId: dailyCollectionId },
      });

      await tx.dailyCollection.update({
        where: { id: dailyCollectionId },
        data: {
          totalCollected: allEntries.reduce((sum, entryItem) => sum + Number(entryItem.receivedAmount), 0),
          totalExpected: allEntries.reduce((sum, entryItem) => sum + Number(entryItem.dueAmount), 0),
          entriesCount: allEntries.length,
        },
      });

      // 7. Write to AuditLog
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: null, // Customer action
          action: 'create',
          entityType: 'payment',
          entityId: payment.id,
          newValue: JSON.stringify({
            customerName: loan.customer.name,
            loanCode: loan.loanCode,
            amount,
            paymentMode,
            referenceNumber,
            allocations: allocationsDesc.join(', '),
          }),
        },
      });

      return { success: true, allocated: amount - remaining };
    });

    // Revalidate paths for real-time updates
    revalidatePath('/borrower/dashboard');
    revalidatePath('/collection');
    revalidatePath('/dashboard');
    revalidatePath(`/loans/${loan.loanCode}`);

    return {
      success: true,
      message: `Successfully processed payment of ₹${amount}. Allocated across instalments.`,
    };
  } catch (error: any) {
    console.error('Error processing borrower self-service payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process simulated payment.',
    };
  }
}
