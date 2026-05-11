'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';

export async function markInstalmentPaid(formData: FormData) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const userId = session?.user?.id;

  const instalmentId = formData.get('instalmentId') as string;
  const receivedAmount = Number(formData.get('receivedAmount'));
  const paymentMode = formData.get('paymentMode') as string || 'cash';
  const remarks = formData.get('remarks') as string || null;

  if (!instalmentId || !receivedAmount || receivedAmount <= 0) {
    return { success: false, error: 'Invalid input' };
  }

  const instalment = await prisma.instalment.findUnique({
    where: { id: instalmentId },
    include: { loan: true },
  });

  if (!instalment || instalment.loan.tenantId !== tenantId) {
    return { success: false, error: 'Instalment not found' };
  }

  const dueAmount = Number(instalment.dueAmount);
  const newStatus = receivedAmount >= dueAmount ? 'paid' : 'partial';

  // Update instalment
  await prisma.instalment.update({
    where: { id: instalmentId },
    data: {
      receivedAmount,
      paymentMode,
      remarks,
      status: newStatus,
      receivedAt: new Date(),
      agentId: userId,
    },
  });

  // Update loan totals
  const allInstalments = await prisma.instalment.findMany({
    where: { loanId: instalment.loanId },
  });

  const paidCount = allInstalments.filter(
    (i) => i.id === instalmentId ? newStatus === 'paid' : i.status === 'paid'
  ).length;

  const totalCollected = allInstalments.reduce((sum, i) => {
    if (i.id === instalmentId) return sum + receivedAmount;
    return sum + Number(i.receivedAmount);
  }, 0);

  const allPaid = paidCount === allInstalments.length;

  await prisma.loan.update({
    where: { id: instalment.loanId },
    data: {
      paidCount,
      totalCollected,
      ...(allPaid ? { status: 'closed', closedAt: new Date() } : {}),
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'update',
      entityType: 'instalment',
      entityId: instalmentId,
      newValue: JSON.stringify({ receivedAmount, paymentMode, status: newStatus }),
    },
  });

  revalidatePath(`/loans/${instalment.loanId}`);
  revalidatePath('/dashboard');
  return { success: true };
}

export async function waiveLoanPenalty(formData: FormData) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const userId = session?.user?.id;

  const penaltyId = formData.get('penaltyId') as string;
  const waivedAmount = Number(formData.get('waivedAmount'));
  const notes = formData.get('notes') as string || null;

  if (!penaltyId) {
    return { success: false, error: 'Invalid input' };
  }

  const penalty = await prisma.penalty.findUnique({
    where: { id: penaltyId },
    include: { loan: true },
  });

  if (!penalty || penalty.loan.tenantId !== tenantId) {
    return { success: false, error: 'Penalty not found' };
  }

  const grossPenalty = Number(penalty.grossPenalty);
  const existingSettled = Number(penalty.settledAmount);
  const newWaived = waivedAmount > 0 ? waivedAmount : grossPenalty - existingSettled;
  const totalResolved = existingSettled + newWaived;
  const newStatus = totalResolved >= grossPenalty ? 'waived' : 'partial';

  await prisma.penalty.update({
    where: { id: penaltyId },
    data: {
      waivedAmount: newWaived,
      status: newStatus,
      settledById: userId,
      notes,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'update',
      entityType: 'penalty',
      entityId: penaltyId,
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

  const penaltyId = formData.get('penaltyId') as string;
  const settledAmount = Number(formData.get('settledAmount'));
  const notes = formData.get('notes') as string || null;

  if (!penaltyId || !settledAmount || settledAmount <= 0) {
    return { success: false, error: 'Invalid input' };
  }

  const penalty = await prisma.penalty.findUnique({
    where: { id: penaltyId },
    include: { loan: true },
  });

  if (!penalty || penalty.loan.tenantId !== tenantId) {
    return { success: false, error: 'Penalty not found' };
  }

  const grossPenalty = Number(penalty.grossPenalty);
  const existingWaived = Number(penalty.waivedAmount);
  const totalResolved = settledAmount + existingWaived;
  const newStatus = totalResolved >= grossPenalty ? 'settled' : 'partial';

  await prisma.penalty.update({
    where: { id: penaltyId },
    data: {
      settledAmount,
      status: newStatus,
      settledById: userId,
      notes,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'update',
      entityType: 'penalty',
      entityId: penaltyId,
      newValue: JSON.stringify({ action: 'settle', settledAmount }),
    },
  });

  revalidatePath(`/loans/${penalty.loanId}`);
  return { success: true };
}

export async function closeLoan(formData: FormData) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const userId = session?.user?.id;

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
    create: { tenantId, key: 'loan_code_counter', value: counter.toString(), category: 'loan' },
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
