import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { bumpAccountBalance } from '@/lib/accounting/balances';
import { BillPostingError, postBillInTx } from '@/lib/accounting/bills';
import { getCashFlowStatement } from '@/lib/accounting/cashflow';
import {
  getCashBankBalance,
  getDailyCashflowSeries,
  getTopExpenses,
} from '@/lib/accounting/queries';
import {
  getOrCreateAccountingSettings,
  getPeriodKey,
  isPremiumAccountingEnabled,
  assertPeriodOpen,
  assignNextEntryNo,
} from '@/lib/accounting/premium';

const ACCOUNTING_ROLES = new Set(['admin', 'superadmin', 'developer']);
const REVIEW_ROLES = new Set(['superadmin', 'developer']);

export type PremiumAccountingActor = {
  tenantId: string;
  userId: string;
  role: string;
  branchId?: string | null;
  appType: string;
};

export class PremiumAccountingServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'PremiumAccountingServiceError';
  }
}

export async function assertPremiumAccountingAccess(actor: PremiumAccountingActor) {
  if (!ACCOUNTING_ROLES.has(actor.role)) {
    throw new PremiumAccountingServiceError('Forbidden', 403);
  }
  const enabled = await isPremiumAccountingEnabled(actor.tenantId);
  if (!enabled) {
    throw new PremiumAccountingServiceError('Premium Accounting is not enabled for your subscription.', 403);
  }
}

export async function getPremiumCashflow(
  actor: PremiumAccountingActor,
  input: { from?: string | null; to?: string | null },
) {
  await assertPremiumAccountingAccess(actor);
  const now = new Date();
  const from = input.from ? new Date(input.from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = input.to ? new Date(input.to) : now;
  const branchId = actor.branchId ?? null;
  // ACC-02: the web Cash Flow statement, same defaults (month start → today).
  const fromStr = input.from || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const toStr = input.to || now.toISOString().split('T')[0];

  const [series, cashBankBalance, topExpenses, statement] = await Promise.all([
    getDailyCashflowSeries(actor.tenantId, branchId, from, to, actor.appType),
    getCashBankBalance(actor.tenantId, branchId, to, actor.appType),
    getTopExpenses(actor.tenantId, branchId, { from, to }, 8, actor.appType),
    getCashFlowStatement(actor.tenantId, actor.appType, branchId, fromStr, toStr),
  ]);
  const totalInflow = series.reduce((sum, row) => sum + row.inflow, 0);
  const totalOutflow = series.reduce((sum, row) => sum + row.outflow, 0);

  return {
    from: isoDate(from),
    to: isoDate(to),
    totalInflow,
    totalOutflow,
    netCashflow: totalInflow - totalOutflow,
    cashBankBalance,
    series,
    topExpenses,
    statement,
  };
}

export async function listPremiumApprovals(
  actor: PremiumAccountingActor,
  input: { status?: string | null; entityType?: string | null; limit?: string | number | null },
) {
  await assertPremiumAccountingAccess(actor);
  const limit = Math.min(100, Math.max(1, Number(input.limit || 50) || 50));
  const where: Prisma.AccountingApprovalWhereInput = {
    tenantId: actor.tenantId,
    appType: actor.appType,
    ...(actor.branchId ? { branchId: actor.branchId } : {}),
    status: input.status || undefined,
    entityType: input.entityType || undefined,
  };
  if (actor.role === 'admin') {
    where.requestedById = actor.userId;
  }

  return prisma.accountingApproval.findMany({
    where,
    include: {
      requestedBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function reviewPremiumApproval(
  actor: PremiumAccountingActor,
  input: { approvalId?: string | null; action?: string | null; note?: string | null },
) {
  await assertPremiumAccountingAccess(actor);
  if (!input.approvalId) throw new PremiumAccountingServiceError('approvalId is required', 400);
  const action = input.action;
  if (!['approve', 'reject', 'cancel'].includes(action || '')) {
    throw new PremiumAccountingServiceError('Invalid approval action', 400);
  }

  const approval = await prisma.accountingApproval.findFirst({
    where: { id: input.approvalId, tenantId: actor.tenantId, appType: actor.appType, ...(actor.branchId ? { branchId: actor.branchId } : {}) },
  });
  if (!approval) throw new PremiumAccountingServiceError('Approval not found', 404);
  if (approval.status !== 'pending') throw new PremiumAccountingServiceError('Already processed', 400);
  const targetWhere = {
    id: approval.entityId,
    tenantId: actor.tenantId,
    appType: actor.appType,
    ...(actor.branchId ? { branchId: actor.branchId } : {}),
  };
  if (approval.entityType === 'journal_entry' && !await prisma.journalEntry.findFirst({ where: targetWhere, select: { id: true } })) {
    throw new PremiumAccountingServiceError('Approval not found', 404);
  }
  if (approval.entityType === 'bill' && !await prisma.bill.findFirst({ where: targetWhere, select: { id: true } })) {
    throw new PremiumAccountingServiceError('Approval not found', 404);
  }

  if (action === 'cancel') {
    if (approval.requestedById !== actor.userId) {
      throw new PremiumAccountingServiceError('Not found or not yours', 404);
    }
    await prisma.$transaction(async (tx) => {
      const changed = await tx.accountingApproval.updateMany({
        where: { id: approval.id, tenantId: actor.tenantId, appType: actor.appType, status: 'pending', requestedById: actor.userId },
        data: { status: 'cancelled' },
      });
      if (changed.count !== 1) throw new PremiumAccountingServiceError('Already processed', 400);
      const targetWhere = { id: approval.entityId, tenantId: actor.tenantId, appType: actor.appType, ...(actor.branchId ? { branchId: actor.branchId } : {}), status: 'pending_approval' };
      if (approval.entityType === 'journal_entry') {
        const target = await tx.journalEntry.updateMany({ where: targetWhere, data: { status: 'draft' } });
        if (target.count !== 1) throw new PremiumAccountingServiceError('Already processed', 400);
      } else if (approval.entityType === 'bill') {
        const target = await tx.bill.updateMany({ where: targetWhere, data: { status: 'draft' } });
        if (target.count !== 1) throw new PremiumAccountingServiceError('Already processed', 400);
      }
      await tx.accountingAuditLog.create({
        data: { tenantId: actor.tenantId, appType: actor.appType, branchId: approval.branchId, userId: actor.userId, action: 'cancel', entityType: approval.entityType, entityId: approval.entityId },
      });
    });
    return { success: true };
  }

  if (!REVIEW_ROLES.has(actor.role)) {
    throw new PremiumAccountingServiceError('Insufficient role', 403);
  }
  if (approval.level > 1 && actor.role !== approval.approverRole) {
    throw new PremiumAccountingServiceError('Insufficient role', 403);
  }

  if (action === 'reject') {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.accountingApproval.updateMany({
        where: { id: approval.id, tenantId: actor.tenantId, appType: actor.appType, status: 'pending' },
        data: { status: 'rejected', approvedById: actor.userId, reviewNote: input.note, reviewedAt: new Date() },
      });
      if (changed.count !== 1) throw new PremiumAccountingServiceError('Already processed', 400);
      const targetWhere = { id: approval.entityId, tenantId: actor.tenantId, appType: actor.appType, ...(actor.branchId ? { branchId: actor.branchId } : {}), status: 'pending_approval' };
      if (approval.entityType === 'journal_entry') {
        const target = await tx.journalEntry.updateMany({ where: targetWhere, data: { status: 'rejected' } });
        if (target.count !== 1) throw new PremiumAccountingServiceError('Already processed', 400);
      } else if (approval.entityType === 'bill') {
        const target = await tx.bill.updateMany({ where: targetWhere, data: { status: 'draft' } });
        if (target.count !== 1) throw new PremiumAccountingServiceError('Already processed', 400);
      }
      await tx.accountingAuditLog.create({
        data: { tenantId: actor.tenantId, appType: actor.appType, branchId: approval.branchId, userId: actor.userId, action: 'reject', entityType: approval.entityType, entityId: approval.entityId, reason: input.note ?? undefined },
      });
    });
    return { success: true };
  }

  const settings = await getOrCreateAccountingSettings(actor.tenantId);
  const amount = Number(approval.amount);
  const threshold = Number(settings.twoLevelApprovalThreshold);
  if (approval.level === 1 && amount > threshold && actor.role === 'superadmin') {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.accountingApproval.updateMany({
        where: { id: approval.id, tenantId: actor.tenantId, appType: actor.appType, status: 'pending' },
        data: { status: 'approved', approvedById: actor.userId, reviewNote: input.note, reviewedAt: new Date() },
      });
      if (changed.count !== 1) throw new PremiumAccountingServiceError('Already processed', 400);
      await tx.accountingApproval.create({
        data: { tenantId: actor.tenantId, appType: actor.appType, branchId: approval.branchId, entityType: approval.entityType, entityId: approval.entityId, amount: approval.amount, level: 2, approverRole: 'developer', requestedById: approval.requestedById },
      });
      await tx.accountingAuditLog.create({
        data: { tenantId: actor.tenantId, appType: actor.appType, branchId: approval.branchId, userId: actor.userId, action: 'approve', entityType: approval.entityType, entityId: approval.entityId, reason: `L1 approved to L2. ${input.note ?? ''}` },
      });
    });
    return { success: true, routedToL2: true };
  }

  await prisma.$transaction(async (tx) => {
    const changed = await tx.accountingApproval.updateMany({
      where: { id: approval.id, tenantId: actor.tenantId, appType: actor.appType, status: 'pending' },
      data: { status: 'approved', approvedById: actor.userId, reviewNote: input.note, reviewedAt: new Date() },
    });
    if (changed.count !== 1) throw new PremiumAccountingServiceError('Already processed', 400);
    const targetWhere = { id: approval.entityId, tenantId: actor.tenantId, appType: actor.appType, ...(actor.branchId ? { branchId: actor.branchId } : {}), status: 'pending_approval' };
    if (approval.entityType === 'journal_entry') {
      const je = await tx.journalEntry.findFirst({ where: targetWhere, include: { lines: true } });
      if (!je) throw new PremiumAccountingServiceError('Already processed', 400);
      try {
        await assertPeriodOpen(actor.tenantId, actor.appType, je.entryDate, actor.role);
      } catch {
        throw new PremiumAccountingServiceError('period_locked', 400);
      }
      const entryNo = await assignNextEntryNo(actor.tenantId, je.entryDate);
      const posted = await tx.journalEntry.updateMany({ where: targetWhere, data: { status: 'posted', entryNo, approvedById: actor.userId, approvedAt: new Date() } });
      if (posted.count !== 1) throw new PremiumAccountingServiceError('Already processed', 400);
      for (const line of je.lines) await bumpAccountBalance(tx, line.accountId, je.entryDate, line.debit, line.credit);
    } else if (approval.entityType === 'bill') {
      try {
        await postBillInTx(tx, { tenantId: actor.tenantId, appType: actor.appType, branchId: actor.branchId ?? null, billId: approval.entityId, actorId: actor.userId, expectedStatus: 'pending_approval' });
      } catch (error) {
        if (error instanceof BillPostingError) throw new PremiumAccountingServiceError(error.message, 400);
        throw error;
      }
    }
    await tx.accountingAuditLog.create({
      data: { tenantId: actor.tenantId, appType: actor.appType, branchId: approval.branchId, userId: actor.userId, action: 'approve', entityType: approval.entityType, entityId: approval.entityId, reason: input.note ?? undefined },
    });
  });
  return { success: true, routedToL2: false };
}

export async function listPremiumBudgets(actor: PremiumAccountingActor, input: { periodKey?: string | null }) {
  await assertPremiumAccountingAccess(actor);
  const periodKey = input.periodKey ?? getPeriodKey(new Date());
  const budgets = await prisma.budget.findMany({
    where: { tenantId: actor.tenantId, appType: actor.appType },
    include: { lines: true },
    orderBy: { createdAt: 'desc' },
  });
  return budgets.map((budget) => {
    const annualTotal = budget.lines.reduce<number>(
      (sum, line) => sum + annualBudgetTotal(line),
      0,
    );
    return {
      id: budget.id,
      name: budget.name,
      fiscalYear: budget.fiscalYear,
      status: budget.status,
      lineCount: budget.lines.length,
      annualTotal,
      periodKey,
      createdAt: budget.createdAt,
      approvedAt: budget.approvedAt,
    };
  });
}

export async function getPremiumTaxSummary(actor: PremiumAccountingActor, input: { periodKey?: string | null }) {
  await assertPremiumAccountingAccess(actor);
  const periodKey = input.periodKey ?? getPeriodKey(new Date());
  const [gst, tds] = await Promise.all([
    actor.branchId ? Promise.resolve(null) : prisma.gstSummary.findUnique({
      where: { tenantId_appType_periodKey_gstType: { tenantId: actor.tenantId, appType: actor.appType, periodKey, gstType: 'GSTR3B' } },
    }),
    prisma.tdsDeduction.findMany({
      where: { tenantId: actor.tenantId, appType: actor.appType, periodKey, bill: { appType: actor.appType, ...(actor.branchId ? { branchId: actor.branchId } : {}) } },
      include: { bill: { include: { vendor: { select: { name: true, pan: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const outputCGST = Number(gst?.outputCgst ?? 0);
  const outputSGST = Number(gst?.outputSgst ?? 0);
  const outputIGST = Number(gst?.outputIgst ?? 0);
  const inputCGST = Number(gst?.inputCgst ?? 0);
  const inputSGST = Number(gst?.inputSgst ?? 0);
  const inputIGST = Number(gst?.inputIgst ?? 0);

  return {
    periodKey,
    gstScope: actor.branchId ? 'all_branches_required' : 'all_branches',
    gst: {
      outputCGST,
      outputSGST,
      outputIGST,
      inputCGST,
      inputSGST,
      inputIGST,
      netLiability: Number(gst?.netLiability ?? 0),
      status: gst?.filedAt ? 'filed' : 'draft',
      filedAt: gst?.filedAt ?? null,
    },
    tds: tds.map((row) => ({
      id: row.id,
      vendorName: row.bill?.vendor?.name ?? '',
      pan: row.bill?.vendor?.pan ?? '',
      section: row.section,
      baseAmount: Number(row.baseAmount),
      tdsAmount: Number(row.tdsAmount),
      status: row.status,
      challanNo: row.challanNo,
    })),
  };
}

export async function getPremiumAccountingSettings(actor: PremiumAccountingActor) {
  await assertPremiumAccountingAccess(actor);
  const settings = await getOrCreateAccountingSettings(actor.tenantId);
  return {
    fiscalYearStartMonth: settings.fiscalYearStartMonth,
    gstin: settings.gstin,
    state: settings.state,
    gstScheme: settings.gstScheme,
    baseCurrency: settings.baseCurrency,
    postingOverrides: settings.postingOverrides,
    costCentresEnabled: settings.costCentresEnabled,
    baseAccountingMode: settings.baseAccountingMode,
    showPremiumBannerInBase: settings.showPremiumBannerInBase,
    adminJeCap: Number(settings.adminJeCap),
    adminBillCap: Number(settings.adminBillCap),
    twoLevelApprovalThreshold: Number(settings.twoLevelApprovalThreshold),
    adminCanEditCoA: settings.adminCanEditCoA,
    adminCanLockPeriod: settings.adminCanLockPeriod,
    varianceAlertPct: Number(settings.varianceAlertPct),
    apOverdueAlertDays: settings.apOverdueAlertDays,
    tallyConnectorEnabled: settings.tallyConnectorEnabled,
    tallyConnectorUrl: settings.tallyConnectorUrl,
    tallyCompanyName: settings.tallyCompanyName,
    allowFutureDated: settings.allowFutureDated,
    defaultBankAccountId: settings.defaultBankAccountId,
    defaultCashAccountId: settings.defaultCashAccountId,
  };
}

function annualBudgetTotal(line: {
  jan: unknown; feb: unknown; mar: unknown; apr: unknown; may: unknown; jun: unknown;
  jul: unknown; aug: unknown; sep: unknown; oct: unknown; nov: unknown; dec: unknown;
}) {
  return [
    line.jan, line.feb, line.mar, line.apr, line.may, line.jun,
    line.jul, line.aug, line.sep, line.oct, line.nov, line.dec,
  ].reduce<number>((sum, value) => sum + Number(value ?? 0), 0);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
