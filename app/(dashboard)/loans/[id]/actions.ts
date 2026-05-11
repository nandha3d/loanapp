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

  if (!loanId) {
    return { success: false, error: 'Invalid input' };
  }

  const loan = await prisma.loan.findUnique({
    where: { id: loanId, tenantId },
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

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'update',
      entityType: 'loan',
      entityId: loanId,
      newValue: JSON.stringify({ action: 'close', closedAt: new Date().toISOString() }),
    },
  });

  revalidatePath(`/loans/${loanId}`);
  revalidatePath('/loans');
  revalidatePath('/dashboard');
  return { success: true };
}
