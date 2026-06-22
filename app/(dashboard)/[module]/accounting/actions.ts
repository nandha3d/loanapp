'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
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

  if (syncsBranchCash && !activeBranchId) {
    return { error: 'Select an active branch before adding or withdrawing cash capital.' };
  }

  const entry = await prisma.$transaction(async (tx) => {
    const accountEntry = await tx.accountEntry.create({
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

    if (syncsBranchCash) {
      await applyAccountingCashToBranch(tx, {
        tenantId,
        branchId: activeBranchId!,
        amount,
        entryType: type as 'capital_add' | 'capital_withdraw',
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

  const loans = await prisma.loan.findMany({
    where: { tenantId, ...(branchId ? { branchId } : {}) },
    select: {
      startDate: true,
      principal: true,
      deduction: true,
      totalPayable: true,
    },
  });
  const agentIds = branchId
    ? await prisma.user.findMany({
        where: { tenantId, branchId, role: 'agent' },
        select: { id: true },
      }).then((rows) => rows.map((row) => row.id))
    : null;
  const releaseWhere = {
    tenantId,
    accountKind: 'branch',
    type: 'release',
    ...(branchId ? { branchId } : {}),
  };
  const [releasedAgg, releaseEntries, branchCashAgg, agentFloatAgg] = await Promise.all([
    prisma.walletTransaction.aggregate({
      where: releaseWhere,
      _sum: { amount: true },
    }),
    prisma.walletTransaction.findMany({
      where: releaseWhere,
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.branchCashAccount.aggregate({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      _sum: { balance: true },
    }),
    prisma.agentAccount.aggregate({
      where: { tenantId, ...(agentIds ? { agentId: { in: agentIds } } : {}) },
      _sum: { balance: true },
    }),
  ]);
  const releasedToAgents = Math.abs(Number(releasedAgg._sum.amount ?? 0));

  return {
    capitalIn,
    capitalOut,
    totalDisbursed,
    totalCollected,
    totalExpenses,
    currentCapital,
    grossProfit,
    netProfit,
    releasedToAgents,
    branchCashAvailable: Number(branchCashAgg._sum.balance ?? 0),
    agentFloat: Number(agentFloatAgg._sum.balance ?? 0),
    releaseEntries,
    loans,
    entries,
  };
}
