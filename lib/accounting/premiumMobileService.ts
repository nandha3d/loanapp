import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import {
  getCashBankBalance,
  getDailyCashflowSeries,
  getTopExpenses,
} from '@/lib/accounting/queries';
import {
  getOrCreateAccountingSettings,
  getPeriodKey,
  isPremiumAccountingEnabled,
  writeAuditLog,
} from '@/lib/accounting/premium';

const ACCOUNTING_ROLES = new Set(['admin', 'superadmin', 'developer']);
const REVIEW_ROLES = new Set(['superadmin', 'developer']);

export type PremiumAccountingActor = {
  tenantId: string;
  userId: string;
  role: string;
  branchId?: string | null;
  appType?: string | null;
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

  const [series, cashBankBalance, topExpenses] = await Promise.all([
    getDailyCashflowSeries(actor.tenantId, branchId, from, to),
    getCashBankBalance(actor.tenantId, branchId, to),
    getTopExpenses(actor.tenantId, branchId, { from, to }, 8),
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
    where: { id: input.approvalId, tenantId: actor.tenantId },
  });
  if (!approval) throw new PremiumAccountingServiceError('Approval not found', 404);
  if (approval.status !== 'pending') throw new PremiumAccountingServiceError('Already processed', 400);

  if (action === 'cancel') {
    if (approval.requestedById !== actor.userId) {
      throw new PremiumAccountingServiceError('Not found or not yours', 404);
    }
    await prisma.accountingApproval.update({
      where: { id: approval.id },
      data: { status: 'cancelled' },
    });
    await writeAuditLog({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'cancel',
      entityType: approval.entityType,
      entityId: approval.entityId,
    });
    return { success: true };
  }

  if (!REVIEW_ROLES.has(actor.role)) {
    throw new PremiumAccountingServiceError('Insufficient role', 403);
  }

  if (action === 'reject') {
    await prisma.accountingApproval.update({
      where: { id: approval.id },
      data: {
        status: 'rejected',
        approvedById: actor.userId,
        reviewNote: input.note,
        reviewedAt: new Date(),
      },
    });
    if (approval.entityType === 'journal_entry') {
      await prisma.journalEntry.update({ where: { id: approval.entityId }, data: { status: 'rejected' } });
    } else if (approval.entityType === 'bill') {
      await prisma.bill.update({ where: { id: approval.entityId }, data: { status: 'draft' } });
    }
    await writeAuditLog({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'reject',
      entityType: approval.entityType,
      entityId: approval.entityId,
      reason: input.note ?? undefined,
    });
    return { success: true };
  }

  const settings = await getOrCreateAccountingSettings(actor.tenantId);
  const amount = Number(approval.amount);
  const threshold = Number(settings.twoLevelApprovalThreshold);
  if (approval.level === 1 && amount > threshold && actor.role === 'superadmin') {
    await prisma.$transaction([
      prisma.accountingApproval.update({
        where: { id: approval.id },
        data: {
          status: 'approved',
          approvedById: actor.userId,
          reviewNote: input.note,
          reviewedAt: new Date(),
        },
      }),
      prisma.accountingApproval.create({
        data: {
          tenantId: actor.tenantId,
          entityType: approval.entityType,
          entityId: approval.entityId,
          amount: approval.amount,
          level: 2,
          approverRole: 'developer',
          requestedById: approval.requestedById,
        },
      }),
    ]);
    return { success: true, routedToL2: true };
  }

  await prisma.accountingApproval.update({
    where: { id: approval.id },
    data: {
      status: 'approved',
      approvedById: actor.userId,
      reviewNote: input.note,
      reviewedAt: new Date(),
    },
  });
  if (approval.entityType === 'journal_entry') {
    const count = await prisma.journalEntry.count({ where: { tenantId: actor.tenantId } });
    const je = await prisma.journalEntry.findFirst({ where: { id: approval.entityId, tenantId: actor.tenantId } });
    if (je && je.status === 'pending_approval') {
      const fyKey = `${je.entryDate.getFullYear()}${String(je.entryDate.getFullYear() + 1).slice(-2)}`;
      await prisma.journalEntry.update({
        where: { id: approval.entityId },
        data: { status: 'posted', entryNo: `JE-${fyKey}-${String(count).padStart(4, '0')}` },
      });
    }
  } else if (approval.entityType === 'bill') {
    const bill = await prisma.bill.findFirst({ where: { id: approval.entityId, tenantId: actor.tenantId } });
    if (bill && bill.status === 'pending_approval') {
      await prisma.bill.update({ where: { id: approval.entityId }, data: { status: 'unpaid' } });
    }
  }
  await writeAuditLog({
    tenantId: actor.tenantId,
    userId: actor.userId,
    action: 'approve',
    entityType: approval.entityType,
    entityId: approval.entityId,
    reason: input.note ?? undefined,
  });
  return { success: true, routedToL2: false };
}

export async function listPremiumBudgets(actor: PremiumAccountingActor, input: { periodKey?: string | null }) {
  await assertPremiumAccountingAccess(actor);
  const periodKey = input.periodKey ?? getPeriodKey(new Date());
  const budgets = await prisma.budget.findMany({
    where: { tenantId: actor.tenantId },
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
    prisma.gstSummary.findUnique({
      where: { tenantId_periodKey_gstType: { tenantId: actor.tenantId, periodKey, gstType: 'GSTR3B' } },
    }),
    prisma.tdsDeduction.findMany({
      where: { tenantId: actor.tenantId, periodKey },
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

export async function listPremiumVendors(actor: PremiumAccountingActor, input: { search?: string | null }) {
  await assertPremiumAccountingAccess(actor);
  const search = input.search?.trim();
  const vendors = await prisma.vendor.findMany({
    where: {
      tenantId: actor.tenantId,
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { phone: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      bills: {
        select: { totalAmount: true, paidAmount: true, status: true, dueDate: true },
      },
    },
    orderBy: { name: 'asc' },
    take: 100,
  });

  return vendors.map((vendor) => {
    const openBills = vendor.bills.filter((bill) => ['unpaid', 'partial'].includes(bill.status));
    return {
      id: vendor.id,
      name: vendor.name,
      phone: vendor.phone,
      email: vendor.email,
      pan: vendor.pan,
      gstin: vendor.gstin,
      isActive: vendor.isActive,
      openBillCount: openBills.length,
      outstanding: openBills.reduce(
        (sum, bill) => sum + Number(bill.totalAmount) - Number(bill.paidAmount),
        0,
      ),
    };
  });
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
    costCentresEnabled: settings.costCentresEnabled,
    adminJeCap: Number(settings.adminJeCap),
    adminBillCap: Number(settings.adminBillCap),
    twoLevelApprovalThreshold: Number(settings.twoLevelApprovalThreshold),
    varianceAlertPct: Number(settings.varianceAlertPct),
    apOverdueAlertDays: settings.apOverdueAlertDays,
    tallyConnectorEnabled: settings.tallyConnectorEnabled,
    tallyConnectorUrl: settings.tallyConnectorUrl,
    tallyCompanyName: settings.tallyCompanyName,
    allowFutureDated: settings.allowFutureDated,
  };
}

export async function listPremiumExportRuns(actor: PremiumAccountingActor) {
  await assertPremiumAccountingAccess(actor);
  return prisma.accountingExportRun.findMany({
    where: { tenantId: actor.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
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
