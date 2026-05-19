'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getActiveBranchId } from '@/lib/branch';

export async function addAccountEntry(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!userId || !['admin', 'superadmin', 'developer'].includes(role)) {
    return { error: 'Unauthorized' };
  }

  const tenantId = await getDefaultTenantId();
  const activeBranchId = await getActiveBranchId();
  const type = formData.get('type') as string;
  const category = formData.get('category') as string || 'cash';
  const amount = Number(formData.get('amount'));
  const description = formData.get('description') as string || null;
  const entryDateStr = formData.get('entryDate') as string;

  if (!type || !amount || amount <= 0) {
    return { error: 'Type and a positive amount are required' };
  }

  const entryDate = entryDateStr ? new Date(entryDateStr) : new Date();

  await prisma.accountEntry.create({
    data: {
      tenantId,
      entryDate,
      type,
      category,
      amount,
      description,
      createdBy: userId,
      branchId: activeBranchId || null,
    },
  });

  revalidatePath('/accounting');
  return { success: true };
}

export async function getAccountingSummary(tenantId: string, branchId?: string | null) {
  // Get all entries for the tenant
  const entries = await prisma.accountEntry.findMany({
    where: { tenantId, ...(branchId ? { branchId } : {}) },
    orderBy: { entryDate: 'desc' },
    include: { user: { select: { name: true } } },
  });

  // Calculate totals
  let capitalIn = 0;
  let capitalOut = 0;
  let totalDisbursed = 0;
  let totalCollected = 0;
  let totalExpenses = 0;

  for (const entry of entries) {
    const amt = Number(entry.amount);
    switch (entry.type) {
      case 'capital_add':
        capitalIn += amt;
        break;
      case 'capital_withdraw':
        capitalOut += amt;
        break;
      case 'loan_disburse':
        totalDisbursed += amt;
        break;
      case 'collection':
        totalCollected += amt;
        break;
      case 'expense':
        totalExpenses += amt;
        break;
    }
  }

  const currentCapital = capitalIn - capitalOut - totalDisbursed + totalCollected - totalExpenses;
  const grossProfit = totalCollected - totalDisbursed;
  const netProfit = grossProfit - totalExpenses;

  return {
    capitalIn,
    capitalOut,
    totalDisbursed,
    totalCollected,
    totalExpenses,
    currentCapital,
    grossProfit,
    netProfit,
    entries, // Return all entries
  };
}
