import prisma from '@/lib/db';
import { POSTING_DEFAULTS } from '@/lib/accounting/postingKeys';
import {
  assertPremiumAccountingAccess,
  PremiumAccountingActor,
  PremiumAccountingServiceError,
} from '@/lib/accounting/premiumMobileService';

export type GstSummaryData = {
  periodKey: string;
  outputTaxable: number; outputCGST: number; outputSGST: number; outputIGST: number;
  inputTaxable: number; inputCGST: number; inputSGST: number; inputIGST: number;
  netCGST: number; netSGST: number; netIGST: number;
  totalLiability: number; itcCarryForward: number;
  status: string; filedAt: Date | null; filedById: string | null;
};

type Taxes = {
  outputCGST: number; outputSGST: number; outputIGST: number;
  inputCGST: number; inputSGST: number; inputIGST: number;
};

export function calculateGstTotals(tax: Taxes) {
  const netCGST = Math.max(0, tax.outputCGST - tax.inputCGST);
  const netSGST = Math.max(0, tax.outputSGST - tax.inputSGST);
  const netIGST = Math.max(0, tax.outputIGST - tax.inputIGST);
  return {
    netCGST, netSGST, netIGST,
    totalLiability: netCGST + netSGST + netIGST,
    itcCarryForward: Math.max(0, tax.inputCGST - tax.outputCGST) +
      Math.max(0, tax.inputSGST - tax.outputSGST) +
      Math.max(0, tax.inputIGST - tax.outputIGST),
  };
}

function monthRange(periodKey: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)) {
    throw new PremiumAccountingServiceError('Invalid period', 400);
  }
  const [year, month] = periodKey.split('-').map(Number);
  return { from: new Date(year, month - 1, 1), to: new Date(year, month, 1) };
}

function assertGlobal(actor: PremiumAccountingActor) {
  if (actor.branchId) throw new PremiumAccountingServiceError('Select all branches for GST filing', 403);
}

function assertReviewer(actor: PremiumAccountingActor) {
  if (!['superadmin', 'developer'].includes(actor.role)) {
    throw new PremiumAccountingServiceError('Insufficient role', 403);
  }
}

function display(periodKey: string, tax: Taxes, filedAt: Date | null, filedById: string | null): GstSummaryData {
  return {
    periodKey, outputTaxable: 0, inputTaxable: 0, ...tax,
    ...calculateGstTotals(tax), status: filedAt ? 'filed' : 'draft', filedAt, filedById,
  };
}

export async function getGstSummary(actor: PremiumAccountingActor, periodKey: string) {
  await assertPremiumAccountingAccess(actor);
  monthRange(periodKey);
  if (actor.branchId) return null;
  const row = await prisma.gstSummary.findUnique({
    where: { tenantId_appType_periodKey_gstType: {
      tenantId: actor.tenantId, appType: actor.appType, periodKey, gstType: 'GSTR3B',
    } },
  });
  if (!row) return null;
  return display(periodKey, {
    outputCGST: Number(row.outputCgst), outputSGST: Number(row.outputSgst),
    outputIGST: Number(row.outputIgst), inputCGST: Number(row.inputCgst),
    inputSGST: Number(row.inputSgst), inputIGST: Number(row.inputIgst),
  }, row.filedAt, row.filedById);
}

export async function recomputeGstSummary(actor: PremiumAccountingActor, periodKey: string) {
  await assertPremiumAccountingAccess(actor);
  assertGlobal(actor);
  const { from, to } = monthRange(periodKey);
  return prisma.$transaction(async (tx) => {
    const settings = await tx.accountingSettings.findUnique({ where: { tenantId: actor.tenantId } });
    let overrides: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(settings?.postingOverrides || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) overrides = parsed;
    } catch { /* Legacy malformed overrides use canonical defaults. */ }
    const keys = ['output_cgst', 'output_sgst', 'output_igst', 'input_cgst', 'input_sgst', 'input_igst'] as const;
    const codes = keys.map((key) => typeof overrides[key] === 'string' && (overrides[key] as string).trim()
      ? (overrides[key] as string).trim() : POSTING_DEFAULTS[key]);
    const accounts = await tx.account.findMany({
      where: { tenantId: actor.tenantId, code: { in: codes } }, select: { id: true, code: true },
    });
    const byCode = new Map(accounts.map((account) => [account.code, account.id]));
    const totals = await Promise.all(keys.map(async (key, index) => {
      const accountId = byCode.get(codes[index]);
      if (!accountId) return 0;
      const field = key.startsWith('output') ? 'credit' : 'debit';
      const sum = await tx.journalLine.aggregate({
        _sum: { [field]: true },
        where: { accountId, entry: {
          tenantId: actor.tenantId, appType: actor.appType, status: 'posted',
          entryDate: { gte: from, lt: to },
        } },
      });
      return Number(sum._sum[field] ?? 0);
    }));
    const tax: Taxes = {
      outputCGST: totals[0], outputSGST: totals[1], outputIGST: totals[2],
      inputCGST: totals[3], inputSGST: totals[4], inputIGST: totals[5],
    };
    const alreadyFiled = await tx.gstSummary.findUnique({
      where: { tenantId_appType_periodKey_gstType: {
        tenantId: actor.tenantId, appType: actor.appType, periodKey, gstType: 'GSTR3B',
      } }, select: { filedAt: true },
    });
    if (alreadyFiled?.filedAt) throw new PremiumAccountingServiceError('Already filed', 409);
    const row = await tx.gstSummary.upsert({
      where: { tenantId_appType_periodKey_gstType: {
        tenantId: actor.tenantId, appType: actor.appType, periodKey, gstType: 'GSTR3B',
      } },
      create: {
        tenantId: actor.tenantId, appType: actor.appType, periodKey, gstType: 'GSTR3B',
        outputCgst: tax.outputCGST, outputSgst: tax.outputSGST, outputIgst: tax.outputIGST,
        inputCgst: tax.inputCGST, inputSgst: tax.inputSGST, inputIgst: tax.inputIGST,
        netLiability: calculateGstTotals(tax).totalLiability,
      },
      update: {
        outputCgst: tax.outputCGST, outputSgst: tax.outputSGST, outputIgst: tax.outputIGST,
        inputCgst: tax.inputCGST, inputSgst: tax.inputSGST, inputIgst: tax.inputIGST,
        netLiability: calculateGstTotals(tax).totalLiability,
      },
    });
    await tx.accountingAuditLog.create({ data: {
      tenantId: actor.tenantId, appType: actor.appType, branchId: null, userId: actor.userId,
      action: 'recompute_gst', entityType: 'gst_summary', entityId: row.id,
    } });
    return display(periodKey, tax, row.filedAt, row.filedById);
  });
}

export async function markGstFiled(actor: PremiumAccountingActor, periodKey: string, ackNo: string) {
  await assertPremiumAccountingAccess(actor);
  assertGlobal(actor);
  assertReviewer(actor);
  monthRange(periodKey);
  if (typeof ackNo !== 'string' || !ackNo.trim()) {
    throw new PremiumAccountingServiceError('Acknowledgement number is required', 400);
  }
  return prisma.$transaction(async (tx) => {
    const row = await tx.gstSummary.findUnique({
      where: { tenantId_appType_periodKey_gstType: {
        tenantId: actor.tenantId, appType: actor.appType, periodKey, gstType: 'GSTR3B',
      } }, select: { id: true, filedAt: true },
    });
    if (!row) throw new PremiumAccountingServiceError('No summary found. Recompute first.', 404);
    if (row.filedAt) throw new PremiumAccountingServiceError('Already filed', 409);
    const filedAt = new Date();
    const changed = await tx.gstSummary.updateMany({
      where: { id: row.id, tenantId: actor.tenantId, appType: actor.appType, filedAt: null },
      data: { filedAt, filedById: actor.userId },
    });
    if (changed.count !== 1) throw new PremiumAccountingServiceError('Already filed', 409);
    await tx.accountingAuditLog.create({ data: {
      tenantId: actor.tenantId, appType: actor.appType, branchId: null, userId: actor.userId,
      action: 'mark_gst_filed', entityType: 'gst_summary', entityId: row.id,
      after: JSON.stringify({ filedAt: filedAt.toISOString(), ackNo: ackNo.trim() }),
    } });
    return { filedAt };
  });
}

function quarterRange(quarterKey: string) {
  const match = /^Q([1-4])-(\d{4})-\d{2}$/.exec(quarterKey);
  if (!match) throw new PremiumAccountingServiceError('Invalid quarter', 400);
  const year = Number(match[2]);
  const start = 3 + (Number(match[1]) - 1) * 3;
  return { from: new Date(year, start, 1), to: new Date(year, start + 3, 1) };
}

export async function getTdsRegister(actor: PremiumAccountingActor, quarterKey: string) {
  await assertPremiumAccountingAccess(actor);
  const { from, to } = quarterRange(quarterKey);
  const rows = await prisma.tdsDeduction.findMany({
    where: { tenantId: actor.tenantId, appType: actor.appType,
      createdAt: { gte: from, lt: to },
      bill: { tenantId: actor.tenantId, appType: actor.appType,
        ...(actor.branchId ? { branchId: actor.branchId } : {}) },
    },
    include: { bill: { select: { vendor: { select: { name: true, pan: true } } } } },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((row) => ({ id: row.id, vendorName: row.bill?.vendor.name ?? '',
    pan: row.bill?.vendor.pan ?? '', section: row.section,
    taxableAmount: Number(row.baseAmount), ratePct: Number(row.rate),
    tdsAmount: Number(row.tdsAmount), challanNo: row.challanNo, status: row.status,
  }));
}

export function validateChallanAmount(amount: number, deductions: Array<{ tdsAmount: number }>) {
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(cents) ||
      Math.abs(amount * 100 - cents) > 0.00001 || !deductions.length ||
      deductions.reduce((sum, row) => sum + Math.round(row.tdsAmount * 100), 0) !== cents) {
    throw new PremiumAccountingServiceError('Challan amount must match selected deductions', 400);
  }
}

export async function recordChallan(actor: PremiumAccountingActor, input: {
  challanNo: string; challanDate: string; amount: number; deductionIds: string[];
}) {
  await assertPremiumAccountingAccess(actor);
  assertReviewer(actor);
  if (!input || typeof input.challanNo !== 'string' || !input.challanNo.trim() ||
      typeof input.challanDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.challanDate) ||
      !Array.isArray(input.deductionIds) || !input.deductionIds.length ||
      input.deductionIds.some((id) => typeof id !== 'string' || !id) ||
      new Set(input.deductionIds).size !== input.deductionIds.length) {
    throw new PremiumAccountingServiceError('Invalid challan', 400);
  }
  const challanDate = new Date(input.challanDate);
  if (Number.isNaN(challanDate.getTime())) throw new PremiumAccountingServiceError('Invalid challan date', 400);
  return prisma.$transaction(async (tx) => {
    const rows = await tx.tdsDeduction.findMany({
      where: { id: { in: input.deductionIds }, tenantId: actor.tenantId,
        appType: actor.appType, status: 'deducted',
        bill: { tenantId: actor.tenantId, appType: actor.appType,
          ...(actor.branchId ? { branchId: actor.branchId } : {}) },
      }, select: { id: true, tdsAmount: true },
    });
    if (rows.length !== input.deductionIds.length) throw new PremiumAccountingServiceError('Deduction not found', 404);
    validateChallanAmount(input.amount, rows.map((row) => ({ tdsAmount: Number(row.tdsAmount) })));
    const changed = await tx.tdsDeduction.updateMany({
      where: { id: { in: input.deductionIds }, tenantId: actor.tenantId, appType: actor.appType,
        status: 'deducted', bill: { tenantId: actor.tenantId, appType: actor.appType,
          ...(actor.branchId ? { branchId: actor.branchId } : {}) } },
      data: { challanNo: input.challanNo.trim(), challanDate, status: 'remitted' },
    });
    if (changed.count !== rows.length) throw new PremiumAccountingServiceError('Deduction changed concurrently', 409);
    await tx.accountingAuditLog.create({ data: {
      tenantId: actor.tenantId, appType: actor.appType, branchId: actor.branchId ?? null,
      userId: actor.userId, action: 'record_challan', entityType: 'tds',
      after: JSON.stringify({ challanNo: input.challanNo.trim(), deductionIds: input.deductionIds }),
    } });
    return { updated: changed.count };
  });
}
