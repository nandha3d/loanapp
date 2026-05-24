'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { submitCollectionEntry, requestCollectionEdit } from '@/app/(dashboard)/[module]/collection/actions';
import { reallocateLoanRepayments } from '@/lib/repayments';
import { randomUUID } from 'crypto';
import { notify } from '@/lib/notify/events';
export { requestCollectionEdit };

export async function markInstalmentPaid(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: 'Unauthorized' };
  }

  return submitCollectionEntry(formData);
}
export async function waiveLoanPenalty(formData: FormData) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const userId = session?.user?.id;
  const role = (session?.user as any)?.role;

  if (!userId || role === 'agent') {
    return { success: false, error: 'Unauthorized' };
  }

  const penaltyId = formData.get('penaltyId') as string;
  const waivedAmount = Number(formData.get('waivedAmount'));
  const notes = formData.get('notes') as string || null;

  let penalty;
  let targetLoanCode = '';
  if (penaltyId === 'new') {
    const loanId = formData.get('loanId') as string;
    const grossPenalty = Number(formData.get('grossPenalty'));
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, tenantId },
      select: { id: true, customerId: true, loanCode: true },
    });
    if (!loan) return { success: false, error: 'Loan not found' };
    targetLoanCode = loan.loanCode;

    penalty = await prisma.penalty.create({
      data: {
        loanId: loan.id,
        customerId: loan.customerId,
        grossPenalty,
        missedDays: Math.round(grossPenalty / 10), // Rough estimate for display
        status: 'pending',
      }
    });
  } else {
    penalty = await prisma.penalty.findUnique({
      where: { id: penaltyId },
      include: { loan: true },
    });
    if (penalty) {
      targetLoanCode = penalty.loan.loanCode;
    }
  }

  if (!penalty || (penaltyId !== 'new' && (penalty as any).loan.tenantId !== tenantId)) {
    return { success: false, error: 'Penalty not found' };
  }

  const pid = penalty.id;
  const grossPenalty = Number(penalty.grossPenalty);
  const existingSettled = Number(penalty.settledAmount || 0);
  const newWaived = waivedAmount > 0 ? waivedAmount : grossPenalty - existingSettled;
  const totalResolved = existingSettled + newWaived;
  const newStatus = totalResolved >= grossPenalty ? 'waived' : 'partial';

  await prisma.penalty.update({
    where: { id: pid },
    data: {
      waivedAmount: newWaived,
      status: newStatus,
      settledById: userId,
      settledAt: newStatus === 'waived' ? new Date() : null,
      notes,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'update',
      entityType: 'penalty',
      entityId: pid,
      newValue: JSON.stringify({ action: 'waive', waivedAmount: newWaived }),
    },
  });

  revalidatePath(`/loans/${targetLoanCode}`);
  return { success: true };
}

export async function settleLoanPenalty(formData: FormData) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const userId = session?.user?.id;
  const role = (session?.user as any)?.role;

  if (!userId || role === 'agent') {
    return { success: false, error: 'Unauthorized' };
  }

  const penaltyId = formData.get('penaltyId') as string;
  const settledAmount = Number(formData.get('settledAmount'));
  const notes = formData.get('notes') as string || null;

  let penalty;
  let targetLoanCode = '';
  if (penaltyId === 'new') {
    const loanId = formData.get('loanId') as string;
    const grossPenalty = Number(formData.get('grossPenalty'));
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, tenantId },
      select: { id: true, customerId: true, loanCode: true },
    });
    if (!loan) return { success: false, error: 'Loan not found' };
    targetLoanCode = loan.loanCode;

    penalty = await prisma.penalty.create({
      data: {
        loanId: loan.id,
        customerId: loan.customerId,
        grossPenalty,
        missedDays: Math.round(grossPenalty / 10),
        status: 'pending',
      }
    });
  } else {
    penalty = await prisma.penalty.findUnique({
      where: { id: penaltyId },
      include: { loan: true },
    });
    if (penalty) {
      targetLoanCode = penalty.loan.loanCode;
    }
  }

  if (!penalty || (penaltyId !== 'new' && (penalty as any).loan.tenantId !== tenantId)) {
    return { success: false, error: 'Penalty not found' };
  }

  const pid = penalty.id;
  const grossPenalty = Number(penalty.grossPenalty);
  const existingWaived = Number(penalty.waivedAmount || 0);
  const newSettled = settledAmount > 0 ? settledAmount : grossPenalty - existingWaived;
  const totalResolved = existingWaived + newSettled;
  const newStatus = totalResolved >= grossPenalty ? 'settled' : 'partial';

  await prisma.penalty.update({
    where: { id: pid },
    data: {
      settledAmount: newSettled,
      status: newStatus,
      settledById: userId,
      settledAt: newStatus === 'settled' ? new Date() : null,
      notes,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'update',
      entityType: 'penalty',
      entityId: pid,
      newValue: JSON.stringify({ action: 'settle', settledAmount: newSettled }),
    },
  });

  revalidatePath(`/loans/${targetLoanCode}`);
  return { success: true };
}

export async function closeLoan(formData: FormData) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const userId = session?.user?.id;
  const role = (session?.user as any)?.role;

  if (!userId || role === 'agent') {
    return { success: false, error: 'Unauthorized' };
  }

  const loanId = formData.get('loanId') as string;
  const markChequesReturned = formData.get('markChequesReturned') === '1';

  if (!loanId) {
    return { success: false, error: 'Invalid input' };
  }

  const loan = await prisma.loan.findUnique({
    where: { id: loanId, tenantId },
    include: { customer: { include: { securityCheques: true } } },
  });

  if (!loan) {
    return { success: false, error: 'Loan not found' };
  }

  // Phase 1.4: Full-settlement validation
  const instalments = await prisma.instalment.findMany({
    where: { loanId }
  });
  const unpaidInstalments = instalments.some(i => !['paid', 'waived'].includes(i.status));
  if (unpaidInstalments) {
    return { success: false, error: 'Cannot close loan with unpaid or upcoming instalments' };
  }

  const pendingPenalties = await prisma.penalty.findMany({
    where: { loanId, status: { in: ['pending', 'partial'] } }
  });
  if (pendingPenalties.length > 0) {
    return { success: false, error: 'Cannot close loan with outstanding penalties' };
  }

  const pendingApprovals = await prisma.approvalRequest.findMany({
    where: { entityId: loanId, entityType: 'loan', status: 'pending' }
  });
  if (pendingApprovals.length > 0) {
    return { success: false, error: 'Cannot close loan with pending approval requests' };
  }

  await prisma.loan.update({
    where: { id: loanId },
    data: {
      status: 'closed',
      closedAt: new Date(),
    },
  });

  notify({
    tenantId,
    event: 'loan_closed',
    phone: loan.customer.phone,
    email: loan.customer.email ?? undefined,
    data: {
      name: loan.customer.name,
      loanCode: loan.loanCode,
    },
    meta: { entityType: 'loan', entityId: loanId },
  }).catch((err) => console.error('Failed to send loan closed notification', err));

  // Mark active security cheques as returned if confirmed
  if (markChequesReturned && loan.customer?.securityCheques?.length) {
    const activeChequeIds = loan.customer.securityCheques
      .filter((c) => c.status === 'active')
      .map((c) => c.id);
    if (activeChequeIds.length > 0) {
      await prisma.securityCheque.updateMany({
        where: { id: { in: activeChequeIds } },
        data: { status: 'returned' },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'update',
      entityType: 'loan',
      entityId: loanId,
      newValue: JSON.stringify({ action: 'close', closedAt: new Date().toISOString(), chequesReturned: markChequesReturned }),
    },
  });

  revalidatePath(`/loans/${loan.loanCode}`);
  revalidatePath('/loans');
  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Loan Renewal
 * - Closes the existing loan (status → "closed")
 * - Creates a fresh loan with the same terms, same customerId
 * - New loan starts today with a new loanCode and fresh instalment schedule
 * - Old loanCode preserved in voucherRef for traceability
 */
export async function renewLoan(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  const tenantId = await getDefaultTenantId();

  if (!userId || role === 'agent') {
    return { success: false, error: 'Unauthorized' };
  }

  const loanId = formData.get('loanId') as string;

  const oldLoan = await prisma.loan.findUnique({
    where: { id: loanId, tenantId },
  });

  if (!oldLoan) return { success: false, error: 'Loan not found' };
  if (oldLoan.status === 'settled') {
    return { success: false, error: 'Settled loans cannot be renewed' };
  }

  // Phase 1.5: Make renewLoan transaction-safe
  const { getSetting } = await import('@/lib/tenant');
  const prefix = await getSetting(tenantId, 'loan_code_prefix', 'LN');
  const { calculateEndDate, calculateInstalmentDates } = await import('@/lib/utils');

  const result = await prisma.$transaction(async (tx) => {
    // 1. Close the old loan
    await tx.loan.update({
      where: { id: loanId },
      data: { status: 'closed', closedAt: new Date() },
    });

    // 2. Generate new loan code
    const counterSetting = await tx.appSetting.findUnique({
      where: { tenantId_key: { tenantId, key: 'loan_code_counter' } }
    });
    const counterStr = counterSetting ? counterSetting.value : '0';
    const counter = parseInt(counterStr) + 1;
    const loanCode = `${prefix}${String(counter).padStart(4, '0')}`;

    await tx.appSetting.upsert({
      where: { tenantId_key: { tenantId, key: 'loan_code_counter' } },
      create: { tenantId, key: 'loan_code_counter', value: counter.toString(), group: 'system' },
      update: { value: counter.toString() },
    });

    // 3. Build new instalment schedule starting today
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = calculateEndDate(startDate, oldLoan.frequency, oldLoan.tenure);
    const instalmentDates = calculateInstalmentDates(startDate, oldLoan.frequency, oldLoan.tenure);
    const perInstalment = Number(oldLoan.perInstalment);

    // 4. Create new loan
    const newLoan = await tx.loan.create({
      data: {
        tenantId,
        branchId: oldLoan.branchId,
        loanCode,
        customerId: oldLoan.customerId,
        packageId: oldLoan.packageId,
        loanType: oldLoan.loanType,
        appType: oldLoan.appType,
        collateralDetails: oldLoan.collateralDetails,
        guarantorId: oldLoan.guarantorId,
        principal: oldLoan.principal,
        deduction: oldLoan.deduction,
        deductionType: oldLoan.deductionType,
        disbursed: oldLoan.disbursed,
        frequency: oldLoan.frequency,
        tenure: oldLoan.tenure,
        startDate,
        endDate,
        perInstalment: oldLoan.perInstalment,
        penaltyRate: oldLoan.penaltyRate,
        voucherRef: `RENEWAL_OF_${oldLoan.loanCode}`,
        status: 'active',
        totalInstalments: oldLoan.tenure,
        createdById: userId,
        instalments: {
          create: instalmentDates.map((date, index) => ({
            instalmentNo: index + 1,
            dueDate: date,
            dueAmount: perInstalment,
            status: 'upcoming' as const,
          })),
        },
      },
    });

    // 5. Audit Log
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'create',
        entityType: 'loan',
        entityId: newLoan.id,
        oldValue: JSON.stringify({ renewedFrom: loanId, oldLoanCode: oldLoan.loanCode }),
        newValue: JSON.stringify({ loanCode, action: 'renewal' }),
      },
    });

    return newLoan;
  });

  revalidatePath(`/loans/${result.loanCode}`);
  revalidatePath('/loans');
  return { success: true, newLoanId: result.loanCode };
}

export async function precloseLoanAdmin(formData: FormData) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: 'Unauthorized' };
  }

  const loanId = formData.get('loanId') as string;
  const amount = Number(formData.get('amount'));
  const paymentMode = formData.get('paymentMode') as string;
  const remarks = (formData.get('remarks') as string) || '';

  if (!loanId || isNaN(amount) || amount <= 0) {
    return { success: false, error: 'Invalid input' };
  }

  const loan = await prisma.loan.findUnique({
    where: { id: loanId, tenantId },
    include: {
      customer: true,
      instalments: {
        orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
      },
    },
  });

  if (!loan) {
    return { success: false, error: 'Loan not found' };
  }

  try {
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
          referenceNumber: `PRECLOSE-${randomUUID().substring(0, 8).toUpperCase()}`,
          paymentDate: new Date(),
          status: 'completed',
        },
      });

      // Get or create DailyCollection atomically using SQL to avoid Prisma timezone bugs
      const newCollectionId = randomUUID();
      await tx.$executeRaw`
        INSERT INTO daily_collections
           (id, tenant_id, app_type, agent_id, branch_id, date, total_expected, total_collected, entries_count, status, created_at, updated_at)
         VALUES (${newCollectionId}, ${tenantId}, ${loan.appType}, ${userId}, ${loan.branchId ?? null}, CURDATE(), 0, 0, 0, 'open', NOW(), NOW())
         ON DUPLICATE KEY UPDATE id = id
      `;

      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM daily_collections
         WHERE tenant_id = ${tenantId} AND app_type = ${loan.appType} AND agent_id = ${userId} AND date = CURDATE()
         LIMIT 1
      `;
      if (!rows[0]) throw new Error('DailyCollection not found after upsert');
      const dailyCollectionId = rows[0].id;

      // Pick the instalment closest to today (first one with dueDate >= today, or last if all past-due)
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const closureInst = unpaidInstalments.find(i => new Date(i.dueDate) >= todayStart) || unpaidInstalments[unpaidInstalments.length - 1];
      const allocationsDesc: string[] = [];

      // 1. Create ONE PaymentAllocation for the closure instalment
      await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          instalmentId: closureInst.id,
          amount: amount, // The full lump-sum
        },
      });

      // 2. Update the closure Instalment record with the FULL amount
      const received = Number(closureInst.receivedAmount || 0);
      const nextReceived = Number((received + amount).toFixed(2));
      
      await tx.instalment.update({
        where: { id: closureInst.id },
        data: {
          receivedAmount: nextReceived,
          status: 'paid',
          receivedAt: new Date(),
          remarks: remarks || `Preclosed`,
        },
      });

      // 3. Create ONE CollectionEntry
      const collectionEntry = await tx.collectionEntry.create({
        data: {
          id: randomUUID(),
          collectionId: dailyCollectionId,
          customerId: loan.customerId,
          loanId: loan.id,
          dueAmount: Number(closureInst.dueAmount),
          receivedAmount: amount, // The full lump-sum
          paymentMode,
          remarks: remarks || `Preclosed | Payment ID: ${payment.id}`,
          agentId: userId,
          submittedAt: new Date(),
          isLocked: true,
          verificationStatus: 'verified',
          tenantId,
        },
      });

      // 3.5 Record the AccountEntry so it reflects in the company's capital balance
      await tx.accountEntry.create({
        data: {
          tenantId,
          entryDate: new Date(),
          type: 'collection',
          category: paymentMode === 'cash' ? 'cash' : 'upi',
          amount: amount,
          description: `Preclosure Settlement: ${loan.customer.name}`,
        }
      });

      allocationsDesc.push(`#${closureInst.instalmentNo} (+₹${amount})`);

      // 4. Mark all OTHER unpaid instalments as 'waived'
      const otherInstIds = unpaidInstalments.filter(i => i.id !== closureInst.id).map(i => i.id);
      if (otherInstIds.length > 0) {
        await tx.instalment.updateMany({
          where: { id: { in: otherInstIds } },
          data: {
            status: 'waived',
            remarks: 'Waived due to Preclosure',
          }
        });
        allocationsDesc.push(`Waived ${otherInstIds.length} instalments`);
      }

      // Recalculate and reallocate loan totals
      await reallocateLoanRepayments(tx, loanId);

      // Update DailyCollection totals
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

      // Close the loan
      await tx.loan.update({
        where: { id: loanId },
        data: {
          status: 'closed',
          closedAt: new Date(),
        },
      });

      // Write to AuditLog
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'create',
          entityType: 'payment',
          entityId: payment.id,
          newValue: JSON.stringify({
            action: 'preclose',
            amount,
            paymentMode,
            allocations: allocationsDesc.join(', '),
          }),
        },
      });

      return { success: true };
    });

    revalidatePath(`/loans/${loan.loanCode}`);
    return result;
  } catch (error: any) {
    console.error('Error preclosing loan:', error);
    return { success: false, error: error.message || 'Failed to preclose loan' };
  }
}
