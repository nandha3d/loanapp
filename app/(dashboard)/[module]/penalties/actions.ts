'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';

export async function settlePenalty(formData: FormData) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const userId = session?.user?.id;
  const role = (session?.user as any)?.role;

  if (!userId || role === 'agent') {
    return { success: false, error: 'Unauthorized' };
  }

  const penaltyId = formData.get('penaltyId') as string;
  const settledAmount = Number(formData.get('settledAmount'));
  const notes = formData.get('notes') as string || null;

  if (!penaltyId || !settledAmount || settledAmount <= 0) {
    return { success: false, error: 'Invalid input' };
  }

  const penalty = await prisma.penalty.findFirst({
    where: { id: penaltyId, loan: { tenantId, appType } },
    include: { loan: true },
  });

  if (!penalty) {
    return { success: false, error: 'Penalty not found' };
  }

  const gross = Number(penalty.grossPenalty);
  const existingWaived = Number(penalty.waivedAmount);
  const totalResolved = settledAmount + existingWaived;
  const newStatus = totalResolved >= gross ? 'settled' : 'partial';

  await prisma.penalty.update({
    where: { id: penaltyId },
    data: {
      settledAmount,
      status: newStatus,
      settledById: userId,
      settledAt: newStatus === 'settled' ? new Date() : null,
      notes,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId, userId, action: 'update', entityType: 'penalty', entityId: penaltyId,
      newValue: JSON.stringify({ action: 'settle', settledAmount }),
    },
  });

  revalidatePath('/penalties');
  revalidatePath(`/loans/${penalty.loan.loanCode}`);
  return { success: true };
}

export async function waivePenalty(formData: FormData) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const userId = session?.user?.id;
  const role = (session?.user as any)?.role;

  if (!userId || role === 'agent') {
    return { success: false, error: 'Unauthorized' };
  }

  const penaltyId = formData.get('penaltyId') as string;
  const notes = formData.get('notes') as string || null;

  const penalty = await prisma.penalty.findUnique({
    where: { id: penaltyId },
    include: { loan: true },
  });

  if (!penalty || penalty.loan.tenantId !== tenantId || penalty.loan.appType !== appType) {
    return { success: false, error: 'Penalty not found' };
  }

  const gross = Number(penalty.grossPenalty);
  const existingSettled = Number(penalty.settledAmount);
  const waivedAmount = gross - existingSettled;

  await prisma.penalty.update({
    where: { id: penaltyId },
    data: { waivedAmount, status: 'waived', settledById: userId, settledAt: new Date(), notes },
  });

  await prisma.auditLog.create({
    data: {
      tenantId, userId, action: 'update', entityType: 'penalty', entityId: penaltyId,
      newValue: JSON.stringify({ action: 'waive', waivedAmount }),
    },
  });

  // Create notification
  await prisma.systemNotification.create({
    data: {
      tenantId,
      type: 'success',
      icon: 'money_off',
      title: 'Penalty Waived',
      message: `Penalty of ${gross} waived for loan ${penalty.loan.loanCode} by admin.`,
      link: `/loans/${penalty.loan.loanCode}`,
    },
  });

  revalidatePath('/penalties');
  revalidatePath(`/loans/${penalty.loan.loanCode}`);
  return { success: true };
}

export async function enforcePenalty(formData: FormData) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const userId = session?.user?.id;
  const role = (session?.user as any)?.role;

  if (!userId || role === 'agent') {
    return { success: false, error: 'Unauthorized' };
  }

  const penaltyId = formData.get('penaltyId') as string;
  const notes = formData.get('notes') as string || null;

  const penalty = await prisma.penalty.findUnique({
    where: { id: penaltyId },
    include: { loan: true },
  });

  if (!penalty || penalty.loan.tenantId !== tenantId || penalty.loan.appType !== appType) {
    return { success: false, error: 'Penalty not found' };
  }

  await prisma.penalty.update({
    where: { id: penaltyId },
    data: { notes, settledById: userId },
  });

  await prisma.auditLog.create({
    data: {
      tenantId, userId, action: 'update', entityType: 'penalty', entityId: penaltyId,
      newValue: JSON.stringify({ action: 'enforce' }),
    },
  });

  revalidatePath('/penalties');
  return { success: true };
}
