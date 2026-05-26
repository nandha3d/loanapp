'use server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { writeAuditLog, getFiscalYear, getPeriodKey } from '@/lib/accounting/premium';

// BudgetLine fields in calendar order
const MONTH_FIELDS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
] as const;
type MonthField = typeof MONTH_FIELDS[number];

// Map calendar month (1-based) to BudgetLine field
function monthToField(calMonth: number): MonthField {
  return MONTH_FIELDS[calMonth - 1];
}

export async function listBudgets() {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const rows = await prisma.budget.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  return JSON.parse(JSON.stringify(rows));
}

export async function createBudget(input: {
  name: string;
  fiscalYear: string;
}) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['superadmin', 'developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  const budget = await prisma.budget.create({
    data: {
      tenantId,
      name: input.name,
      fiscalYear: input.fiscalYear,
    },
  });

  await writeAuditLog({
    tenantId,
    userId: session.user?.id,
    action: 'create',
    entityType: 'budget',
    entityId: budget.id,
  });
  return { ok: true, data: JSON.parse(JSON.stringify(budget)) };
}

export async function getBudgetWithLines(budgetId: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, tenantId },
    include: { lines: { orderBy: { accountId: 'asc' } } },
  });
  if (!budget) return null;

  // Fetch account details separately (BudgetLine has no declared account relation)
  const accountIds = budget.lines.map((l) => l.accountId);
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, code: true, name: true, classType: true },
  });
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  // Compute annual total per line
  const linesWithAccount = budget.lines.map((line) => {
    const annual = MONTH_FIELDS.reduce((sum, f) => sum + Number((line as any)[f] ?? 0), 0);
    return { ...line, account: accountMap.get(line.accountId) ?? null, annual };
  });

  return JSON.parse(JSON.stringify({ ...budget, lines: linesWithAccount }));
}

export async function updateBudgetLine(lineId: string, field: string, value: number) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['superadmin', 'developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  if (!(MONTH_FIELDS as readonly string[]).includes(field))
    return { ok: false, error: 'Invalid field' };

  // Verify line belongs to this tenant's budget
  const line = await prisma.budgetLine.findFirst({
    where: { id: lineId, budget: { tenantId } },
    include: { budget: { select: { status: true } } },
  });
  if (!line) return { ok: false, error: 'Not found' };
  if (line.budget.status === 'approved') return { ok: false, error: 'Approved budget is locked' };

  await prisma.budgetLine.update({
    where: { id: lineId },
    data: { [field]: value },
  });

  return { ok: true };
}

export async function addBudgetLine(budgetId: string, accountId: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['superadmin', 'developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  const existing = await prisma.budgetLine.findFirst({ where: { budgetId, accountId } });
  if (existing) return { ok: false, error: 'Account already in budget' };

  await prisma.budgetLine.create({ data: { budgetId, accountId } });
  return { ok: true };
}

export async function approveBudget(budgetId: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['superadmin', 'developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  const budget = await prisma.budget.findFirst({ where: { id: budgetId, tenantId } });
  if (!budget) return { ok: false, error: 'Not found' };

  await prisma.budget.update({
    where: { id: budgetId },
    data: { status: 'approved', approvedById: session.user?.id ?? null, approvedAt: new Date() },
  });

  await writeAuditLog({
    tenantId,
    userId: session.user?.id,
    action: 'approve',
    entityType: 'budget',
    entityId: budgetId,
  });
  return { ok: true };
}

export async function archiveBudget(budgetId: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['superadmin', 'developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  await prisma.budget.update({ where: { id: budgetId }, data: { status: 'archived' } });
  await writeAuditLog({
    tenantId,
    userId: session.user?.id,
    action: 'update',
    entityType: 'budget',
    entityId: budgetId,
    after: { status: 'archived' },
  });
  return { ok: true };
}

export async function getVarianceForPeriod(budgetId: string, periodKey: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, tenantId },
    include: { lines: true },
  });
  if (!budget) return [];

  // Fetch account details
  const accountIds = budget.lines.map((l) => l.accountId);
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, code: true, name: true, classType: true },
  });
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  // periodKey = 'YYYY-MM', extract calendar month
  const [yr, mo] = periodKey.split('-').map(Number);
  const mField = monthToField(mo);

  const from = new Date(yr, mo - 1, 1);
  const to = new Date(yr, mo, 0);

  // Get actuals per account
  const actuals = await prisma.journalLine.groupBy({
    by: ['accountId'],
    _sum: { debit: true, credit: true },
    where: {
      accountId: { in: accountIds },
      entry: { tenantId, status: 'posted', entryDate: { gte: from, lte: to } },
    },
  });

  const actualMap: Record<string, { debit: number; credit: number }> = {};
  for (const a of actuals) {
    actualMap[a.accountId] = {
      debit: Number(a._sum.debit ?? 0),
      credit: Number(a._sum.credit ?? 0),
    };
  }

  return budget.lines.map((line) => {
    const budgetAmt = Number((line as any)[mField] ?? 0);
    const act = actualMap[line.accountId] ?? { debit: 0, credit: 0 };
    const account = accountMap.get(line.accountId);
    const isIncome = account?.classType === 'income';
    // Income: net = credit - debit; Expense: net = debit - credit
    const actualAmt = isIncome ? act.credit - act.debit : act.debit - act.credit;
    const varAmt = actualAmt - budgetAmt;
    const varPct = budgetAmt !== 0 ? (varAmt / budgetAmt) * 100 : 0;

    return {
      accountId: line.accountId,
      code: account?.code ?? '',
      name: account?.name ?? '',
      classType: account?.classType ?? '',
      budgetAmt,
      actualAmt,
      varAmt,
      varPct,
    };
  });
}

export async function getActiveAccounts() {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const rows = await prisma.account.findMany({
    where: { tenantId, isActive: true, classType: { in: ['income', 'expense'] } },
    select: { id: true, code: true, name: true, classType: true },
    orderBy: { code: 'asc' },
  });
  return JSON.parse(JSON.stringify(rows));
}
