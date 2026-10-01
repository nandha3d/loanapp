'use server';

import { getActiveBranchId, branchScopeWhere } from '@/lib/branch';
import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { settlePenalty as settlePenaltyLib, waivePenalty as waivePenaltyLib } from '@/lib/penalties';

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
  const notes = (formData.get('notes') as string) || null;
  const paymentMode = (formData.get('paymentMode') as string) || 'cash';

  if (!penaltyId || !settledAmount || settledAmount <= 0) {
    return { success: false, error: 'Invalid input' };
  }

  const activeBranchId = await getActiveBranchId();
  try {
    const updated = await settlePenaltyLib({
      tenantId,
      appType,
      branchId: activeBranchId,
      userId,
      role,
      penaltyId,
      amount: settledAmount,
      paymentMode,
      notes,
    });

    revalidatePath('/penalties');
    if (updated?.loan?.loanCode) {
      revalidatePath(`/loans/${updated.loan.loanCode}`);
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to settle penalty' };
  }
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
  const notes = (formData.get('notes') as string) || null;

  const activeBranchId = await getActiveBranchId();
  try {
    const updated = await waivePenaltyLib({
      tenantId,
      appType,
      branchId: activeBranchId,
      userId,
      role,
      penaltyId,
      reason: notes,
    });

    revalidatePath('/penalties');
    if (updated?.loan?.loanCode) {
      revalidatePath(`/loans/${updated.loan.loanCode}`);
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to waive penalty' };
  }
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

  const activeBranchId = await getActiveBranchId();
  const penalty = await prisma.penalty.findFirst({
    where: { id: penaltyId, loan: { tenantId, appType, ...branchScopeWhere(activeBranchId) } },
    include: { loan: true },
  });

  if (!penalty) {
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
  revalidatePath(`/loans/${penalty.loan.loanCode}`);
  return { success: true };
}
