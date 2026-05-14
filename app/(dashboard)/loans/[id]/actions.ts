'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { submitCollectionEntry, requestCollectionEdit } from '@/app/(dashboard)/collection/actions';
export { requestCollectionEdit };

export async function markInstalmentPaid(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  const role = (session?.user as any)?.role;

  if (!userId || role === 'agent') {
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
  if (penaltyId === 'new') {
    const loanId = formData.get('loanId') as string;
    const grossPenalty = Number(formData.get('grossPenalty'));
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, tenantId },
      select: { id: true, customerId: true },
    });
    if (!loan) return { success: false, error: 'Loan not found' };

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

  revalidatePath(`/loans/${penalty.loanId}`);
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
  if (penaltyId === 'new') {
    const loanId = formData.get('loanId') as string;
    const grossPenalty = Number(formData.get('grossPenalty'));
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, tenantId },
      select: { id: true, customerId: true },
    });
    if (!loan) return { success: false, error: 'Loan not found' };

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

  revalidatePath(`/loans/${penalty.loanId}`);
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

  await prisma.loan.update({
    where: { id: loanId },
    data: {
      status: 'closed',
      closedAt: new Date(),
    },
  });

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

  revalidatePath(`/loans/${loanId}`);
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

  // Close the old loan
  await prisma.loan.update({
    where: { id: loanId },
    data: { status: 'closed', closedAt: new Date() },
  });

  // Generate new loan code using existing settings helpers
  const { getSetting } = await import('@/lib/tenant');
  const prefix = await getSetting(tenantId, 'loan_code_prefix', 'LN');
  const counterStr = await getSetting(tenantId, 'loan_code_counter', '0');
  const counter = parseInt(counterStr) + 1;
  const loanCode = `${prefix}${String(counter).padStart(4, '0')}`;

  await prisma.appSetting.upsert({
    where: { tenantId_key: { tenantId, key: 'loan_code_counter' } },
    create: { tenantId, key: 'loan_code_counter', value: counter.toString(), group: 'system' },
    update: { value: counter.toString() },
  });

  // Build new instalment schedule starting today
  const { calculateEndDate, calculateInstalmentDates } = await import('@/lib/utils');
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = calculateEndDate(startDate, oldLoan.frequency, oldLoan.tenure);
  const instalmentDates = calculateInstalmentDates(startDate, oldLoan.frequency, oldLoan.tenure);
  const perInstalment = Number(oldLoan.perInstalment);

  const newLoan = await prisma.loan.create({
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
          status: 'upcoming',
        })),
      },
    },
  });

  await prisma.auditLog.create({
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

  revalidatePath(`/loans/${newLoan.id}`);
  revalidatePath('/loans');
  return { success: true, newLoanId: newLoan.id };
}
