import prisma from '@/lib/db';
import { writeAuditLog } from '@/lib/accounting/premium';
import {
  assertPremiumAccountingAccess,
  PremiumAccountingActor,
  PremiumAccountingServiceError,
} from '@/lib/accounting/premiumMobileService';

export const BUDGET_MONTH_FIELDS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
] as const;

function requireEditor(actor: PremiumAccountingActor) {
  if (!['superadmin', 'developer'].includes(actor.role)) {
    throw new PremiumAccountingServiceError('Insufficient role', 403);
  }
}

function validAmount(value: number) {
  return Number.isFinite(value) && value >= 0 &&
    Number.isSafeInteger(Math.round(value * 100)) &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.00001;
}

export async function listBudgets(actor: PremiumAccountingActor) {
  await assertPremiumAccountingAccess(actor);
  return prisma.budget.findMany({
    where: { tenantId: actor.tenantId, appType: actor.appType },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createBudget(actor: PremiumAccountingActor, input: { name: string; fiscalYear: string }) {
  await assertPremiumAccountingAccess(actor);
  requireEditor(actor);
  const name = input.name?.trim();
  if (!name || !/^\d{4}-\d{2}$/.test(input.fiscalYear)) {
    throw new PremiumAccountingServiceError('Invalid budget name or fiscal year', 400);
  }
  const budget = await prisma.budget.create({
    data: { tenantId: actor.tenantId, appType: actor.appType, name, fiscalYear: input.fiscalYear },
  });
  await writeAuditLog({
    tenantId: actor.tenantId, appType: actor.appType, branchId: actor.branchId,
    userId: actor.userId, action: 'create', entityType: 'budget', entityId: budget.id,
  });
  return budget;
}

export async function getBudget(actor: PremiumAccountingActor, budgetId: string) {
  await assertPremiumAccountingAccess(actor);
  if (typeof budgetId !== 'string' || !budgetId) throw new PremiumAccountingServiceError('Budget not found', 404);
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, tenantId: actor.tenantId, appType: actor.appType },
    include: { lines: { orderBy: { accountId: 'asc' } } },
  });
  if (!budget) throw new PremiumAccountingServiceError('Budget not found', 404);
  const accounts = await prisma.account.findMany({
    where: { tenantId: actor.tenantId, id: { in: budget.lines.map((line) => line.accountId) } },
    select: { id: true, code: true, name: true, classType: true },
  });
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  return {
    ...budget,
    lines: budget.lines.map((line) => ({
      ...line,
      account: accountMap.get(line.accountId) ?? null,
      annual: BUDGET_MONTH_FIELDS.reduce((sum, field) => sum + Number(line[field]), 0),
    })),
  };
}

export async function addBudgetLine(actor: PremiumAccountingActor, budgetId: string, accountId: string) {
  await assertPremiumAccountingAccess(actor);
  requireEditor(actor);
  if (typeof budgetId !== 'string' || !budgetId) throw new PremiumAccountingServiceError('Budget not found', 404);
  if (typeof accountId !== 'string' || !accountId) throw new PremiumAccountingServiceError('Account not found', 404);
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, tenantId: actor.tenantId, appType: actor.appType },
    select: { id: true, status: true },
  });
  if (!budget) throw new PremiumAccountingServiceError('Budget not found', 404);
  if (budget.status !== 'draft') throw new PremiumAccountingServiceError('Budget is locked', 400);
  const account = await prisma.account.findFirst({
    where: { id: accountId, tenantId: actor.tenantId, isActive: true, classType: { in: ['income', 'expense'] } },
    select: { id: true },
  });
  if (!account) throw new PremiumAccountingServiceError('Account not found', 404);
  return prisma.budgetLine.create({ data: { budgetId, accountId } });
}

export async function updateBudgetLine(actor: PremiumAccountingActor, lineId: string, field: string, value: number, budgetId?: string) {
  await assertPremiumAccountingAccess(actor);
  requireEditor(actor);
  if (typeof lineId !== 'string' || !lineId || (budgetId !== undefined && !budgetId)) {
    throw new PremiumAccountingServiceError('Budget line not found', 404);
  }
  if (!(BUDGET_MONTH_FIELDS as readonly string[]).includes(field) || !validAmount(value)) {
    throw new PremiumAccountingServiceError('Invalid budget amount or month', 400);
  }
  const line = await prisma.budgetLine.findFirst({
    where: { id: lineId, budget: { tenantId: actor.tenantId, appType: actor.appType, ...(budgetId ? { id: budgetId } : {}) } },
    include: { budget: { select: { status: true } } },
  });
  if (!line) throw new PremiumAccountingServiceError('Budget line not found', 404);
  if (line.budget.status !== 'draft') throw new PremiumAccountingServiceError('Budget is locked', 400);
  return prisma.budgetLine.update({ where: { id: lineId }, data: { [field]: value } });
}

export async function setBudgetStatus(actor: PremiumAccountingActor, budgetId: string, action: 'approve' | 'archive') {
  await assertPremiumAccountingAccess(actor);
  requireEditor(actor);
  if (typeof budgetId !== 'string' || !budgetId) throw new PremiumAccountingServiceError('Budget not found', 404);
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, tenantId: actor.tenantId, appType: actor.appType },
    select: { id: true, status: true },
  });
  if (!budget) throw new PremiumAccountingServiceError('Budget not found', 404);
  if (action === 'approve' && budget.status !== 'draft') {
    throw new PremiumAccountingServiceError('Budget is not a draft', 400);
  }
  if (action === 'archive' && budget.status === 'archived') {
    throw new PremiumAccountingServiceError('Budget already archived', 400);
  }
  const updated = await prisma.budget.update({
    where: { id: budgetId },
    data: action === 'approve'
      ? { status: 'approved', approvedById: actor.userId, approvedAt: new Date() }
      : { status: 'archived' },
  });
  await writeAuditLog({
    tenantId: actor.tenantId, appType: actor.appType, branchId: actor.branchId,
    userId: actor.userId, action: action === 'approve' ? 'approve' : 'update',
    entityType: 'budget', entityId: budgetId, after: { status: updated.status },
  });
  return updated;
}

export async function getBudgetVariance(actor: PremiumAccountingActor, budgetId: string, periodKey: string) {
  const budget = await getBudget(actor, budgetId);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)) {
    throw new PremiumAccountingServiceError('Invalid period', 400);
  }
  const [year, month] = periodKey.split('-').map(Number);
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);
  const accountIds = budget.lines.map((line) => line.accountId);
  const actuals = await prisma.journalLine.groupBy({
    by: ['accountId'],
    _sum: { debit: true, credit: true },
    where: {
      accountId: { in: accountIds },
      entry: {
        tenantId: actor.tenantId, appType: actor.appType,
        ...(actor.branchId ? { branchId: actor.branchId } : {}),
        status: 'posted', entryDate: { gte: from, lte: to },
      },
    },
  });
  const actualMap = new Map(actuals.map((row) => [row.accountId, {
    debit: Number(row._sum.debit ?? 0), credit: Number(row._sum.credit ?? 0),
  }]));
  return budget.lines.map((line) => {
    const budgetAmt = Number(line[BUDGET_MONTH_FIELDS[month - 1]]);
    const actual = actualMap.get(line.accountId) ?? { debit: 0, credit: 0 };
    const actualAmt = line.account?.classType === 'income'
      ? actual.credit - actual.debit : actual.debit - actual.credit;
    const varAmt = actualAmt - budgetAmt;
    return {
      accountId: line.accountId,
      code: line.account?.code ?? '',
      name: line.account?.name ?? '',
      classType: line.account?.classType ?? '',
      budgetAmt, actualAmt, varAmt,
      varPct: budgetAmt === 0 ? 0 : varAmt / budgetAmt * 100,
    };
  });
}

export async function getBudgetAccounts(actor: PremiumAccountingActor) {
  await assertPremiumAccountingAccess(actor);
  return prisma.account.findMany({
    where: { tenantId: actor.tenantId, isActive: true, classType: { in: ['income', 'expense'] } },
    select: { id: true, code: true, name: true, classType: true },
    orderBy: { code: 'asc' },
  });
}
