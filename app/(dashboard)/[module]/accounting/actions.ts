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

export async function getAccountingSummary(tenantId: string, appType: string, branchId?: string | null) {
  // Get all entries for the tenant + active module
  const entries = await prisma.accountEntry.findMany({
    where: { tenantId, appType, ...(branchId ? { branchId } : {}) },
    orderBy: { entryDate: 'desc' },
    include: { user: { select: { name: true } } },
  });

  // Calculate totals
  let capitalIn = 0;
  let capitalOut = 0;
  // NET cash that physically left the business at disbursement (principal − upfront
  // fee). Used only for the capital/cash balance — NOT the "Total Disbursed" KPI,
  // which reports the gross loan book (see totalDisbursed below).
  let netDisbursed = 0;
  let totalCollected = 0;
  let totalExpenses = 0;
  let chitPayouts = 0; // prize money paid out to chit winners (cash out)

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
        netDisbursed += amt;
        break;
      case 'collection':
        totalCollected += amt;
        break;
      case 'expense':
        totalExpenses += amt;
        break;
      case 'chit_payout':
        chitPayouts += amt;
        break;
    }
  }

  // Capital/cash balance uses NET disbursed (actual cash out). e.g. 10,000 − 900
  // (net out) + 100 (collected) = 9,200. Chit prize payouts are cash out too.
  const currentCapital = capitalIn - capitalOut - netDisbursed + totalCollected - totalExpenses - chitPayouts;

  const loans = await prisma.loan.findMany({
    where: { tenantId, appType, ...(branchId ? { branchId } : {}) },
    select: {
      startDate: true,
      principal: true,
      deduction: true,
      totalPayable: true,
    },
  });

  // Total Disbursed KPI = GROSS loan book (principal), e.g. 1,000 — not the net
  // cash (900). Profit = interest income recognized at disbursement: the upfront
  // fee (deduction) for upfront loans + (totalPayable − principal) for EMI loans.
  const totalDisbursed = loans.reduce((sum, l) => sum + Number(l.principal), 0);
  const interestIncome = loans.reduce(
    (sum, l) => sum + Number(l.deduction) + Math.max(0, Number(l.totalPayable) - Number(l.principal)),
    0,
  );
  const grossProfit = interestIncome;
  const netProfit = interestIncome - totalExpenses;
  const agentIds = branchId
    ? await prisma.user.findMany({
        where: { tenantId, branchId, role: 'agent' },
        select: { id: true },
      }).then((rows) => rows.map((row) => row.id))
    : null;
  const releaseWhere = {
    tenantId,
    appType,
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
      where: { tenantId, appType, ...(branchId ? { branchId } : {}) },
      _sum: { balance: true },
    }),
    prisma.agentAccount.aggregate({
      where: { tenantId, appType, ...(agentIds ? { agentId: { in: agentIds } } : {}) },
      _sum: { balance: true },
    }),
  ]);
  const releasedToAgents = Math.abs(Number(releasedAgg._sum.amount ?? 0));

  // Loan Book Outstanding = amount borrowers still owe (unpaid instalments on
  // live loans). This is the receivable asset — the cash you lent that is still
  // yours, just in someone else's hands.
  const outstandingAgg = await prisma.instalment.aggregate({
    where: { loan: { tenantId, appType, status: { in: ['active', 'overdue'] }, ...(branchId ? { branchId } : {}) } },
    _sum: { dueAmount: true, receivedAmount: true },
  });
  const loanOutstanding = Math.max(
    0,
    Number(outstandingAgg._sum.dueAmount ?? 0) - Number(outstandingAgg._sum.receivedAmount ?? 0),
  );

  const branchCashAvailable = Number(branchCashAgg._sum.balance ?? 0);
  const agentFloat = Number(agentFloatAgg._sum.balance ?? 0);
  // Liquid Cash = all cash physically held (office safe + agents in the field).
  const liquidCash = branchCashAvailable + agentFloat;
  // Net Worth (Capital) = cash on hand + receivable. Stays flat when you lend
  // (cash drops, receivable rises by the same amount).
  const netWorth = liquidCash + loanOutstanding;

  return {
    capitalIn,
    capitalOut,
    totalDisbursed,
    totalCollected,
    totalExpenses,
    currentCapital,
    liquidCash,
    loanOutstanding,
    netWorth,
    grossProfit,
    netProfit,
    releasedToAgents,
    branchCashAvailable,
    agentFloat,
    releaseEntries,
    loans,
    entries,
  };
}
