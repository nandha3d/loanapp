'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getActiveBranchId } from '@/lib/branch';
import { autoPostExpense, autoPostCapitalAdd, autoPostCapitalWithdraw } from '@/lib/accounting/autoPost';
import { applyAccountingCashToBranch } from '@/lib/wallet';

export async function addAccountEntry(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!userId || !['admin', 'superadmin', 'developer'].includes(role)) {
    return { error: 'Unauthorized' };
  }

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
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
  const syncsBranchCash = category === 'cash' && (type === 'capital_add' || type === 'capital_withdraw');
  // A cash expense reduces the branch pool too (so Liquid Cash reflects it), but
  // we don't force a branch — tenant-wide expenses still record without one.
  const isCashExpense = category === 'cash' && type === 'expense';

  if (syncsBranchCash && !activeBranchId) {
    return { error: 'Select an active branch before adding or withdrawing cash capital.' };
  }

  const entry = await prisma.$transaction(async (tx) => {
    const accountEntry = await tx.accountEntry.create({
      data: {
        tenantId,
        appType,
        entryDate,
        type,
        category,
        amount,
        description,
        createdBy: userId,
        branchId: activeBranchId || null,
      },
    });

    if (syncsBranchCash) {
      await applyAccountingCashToBranch(tx, {
        tenantId,
        appType,
        branchId: activeBranchId!,
        amount,
        entryType: type as 'capital_add' | 'capital_withdraw',
        accountEntryId: accountEntry.id,
        byUserId: userId,
        note: description,
      });
    } else if (isCashExpense && activeBranchId) {
      await applyAccountingCashToBranch(tx, {
        tenantId,
        appType,
        branchId: activeBranchId,
        amount,
        entryType: 'expense',
        accountEntryId: accountEntry.id,
        byUserId: userId,
        note: description,
      });
    }

    return accountEntry;
  });

  if (type === 'expense') {
    await autoPostExpense({
      tenantId,
      appType,
      entryId: entry.id,
      description: description || 'Expense',
      amount,
      date: entryDate,
      branchId: activeBranchId,
      createdById: userId,
      category,
    });
  } else if (type === 'capital_add') {
    await autoPostCapitalAdd({
      tenantId,
      appType,
      entryId: entry.id,
      description: description || 'Capital Addition',
      amount,
      date: entryDate,
      branchId: activeBranchId,
      createdById: userId,
      category,
    });
  } else if (type === 'capital_withdraw') {
    await autoPostCapitalWithdraw({
      tenantId,
      appType,
      entryId: entry.id,
      description: description || 'Capital Withdrawal',
      amount,
      date: entryDate,
      branchId: activeBranchId,
      createdById: userId,
      category,
    });
  }

  revalidatePath('/accounting');
  return { success: true };
}
