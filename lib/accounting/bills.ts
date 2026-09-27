import type { Prisma } from '@prisma/client';
import { bumpAccountBalance } from './balances';
import { getFiscalYear, getPeriodKey } from './premium';
import { buildDedupKey, POSTING_DEFAULTS } from './postingKeys';

export class BillPostingError extends Error {}

export function calculateBillTotals(lines: Array<{ amount: number; gstRate?: number }>) {
  if (!lines.length) throw new BillPostingError('Invalid bill line');
  let subtotalCents = 0;
  let gstCents = 0;
  const lineGstCents = lines.map(({ amount, gstRate = 0 }) => {
    const cents = Math.round(amount * 100);
    if (!Number.isFinite(amount) || amount <= 0 ||
        !Number.isSafeInteger(cents) || Math.abs(amount * 100 - cents) > 0.00001 ||
        !Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
      throw new BillPostingError('Invalid bill line');
    }
    const tax = Math.round(cents * gstRate / 100);
    subtotalCents += cents;
    gstCents += tax;
    if (!Number.isSafeInteger(subtotalCents + gstCents)) throw new BillPostingError('Invalid bill amount');
    return tax;
  });
  return { subtotal: subtotalCents / 100, gstAmount: gstCents / 100,
    totalAmount: (subtotalCents + gstCents) / 100, lineGstCents };
}

export function calculateBillPayment(amount: number, tdsAmount: number, outstanding: number) {
  const valid = (value: number) => Number.isFinite(value) && value >= 0 &&
    Number.isSafeInteger(Math.round(value * 100)) &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.00001;
  if (!valid(amount) || amount <= 0 || !valid(tdsAmount) || !valid(outstanding) ||
      tdsAmount > amount || amount > outstanding) throw new BillPostingError('Invalid payment amount');
  return { bankAmount: Math.round((amount - tdsAmount) * 100) / 100,
    remaining: Math.round((outstanding - amount) * 100) / 100 };
}

/** Post one approved or directly authorized bill with its journal and audit. */
export async function postBillInTx(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    appType: string;
    branchId: string | null;
    billId: string;
    actorId: string;
    expectedStatus: 'draft' | 'pending_approval';
  },
) {
  const { tenantId, appType, branchId, billId, actorId, expectedStatus } = input;
  const bill = await tx.bill.findFirst({
    where: { id: billId, tenantId, appType, ...(branchId ? { branchId } : {}), status: expectedStatus },
    include: { vendor: true, lines: true },
  });
  if (!bill) throw new BillPostingError('Already posted');
  if (bill.vendor.tenantId !== tenantId || bill.vendor.appType !== appType || bill.vendor.branchId !== bill.branchId) {
    throw new BillPostingError('account_invalid');
  }

  const settings = await tx.accountingSettings.findUnique({ where: { tenantId } });
  let overrides: Record<string, string> = {};
  try {
    const parsed = JSON.parse(settings?.postingOverrides || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) overrides = parsed;
  } catch { /* Invalid legacy settings use canonical defaults. */ }
  const code = (key: 'vendor_payable' | 'input_cgst' | 'input_sgst') =>
    typeof overrides[key] === 'string' && overrides[key].trim() ? overrides[key].trim() : POSTING_DEFAULTS[key];
  const [payable, cgst, sgst] = await Promise.all([
    tx.account.findFirst({ where: { tenantId, code: code('vendor_payable') }, select: { id: true } }),
    tx.account.findFirst({ where: { tenantId, code: code('input_cgst') }, select: { id: true } }),
    tx.account.findFirst({ where: { tenantId, code: code('input_sgst') }, select: { id: true } }),
  ]);
  if (!payable || (Number(bill.gstAmount) > 0 && (!cgst || !sgst))) {
    throw new BillPostingError('account_invalid');
  }
  const lineAccountIds = [...new Set(bill.lines.map((line) => line.accountId).filter((id): id is string => Boolean(id)))];
  if (bill.lines.some((line) => !line.accountId) || await tx.account.count({ where: { tenantId, id: { in: lineAccountIds } } }) !== lineAccountIds.length) {
    throw new BillPostingError('account_invalid');
  }

  const lines: Array<{ accountId: string; debit: number; credit: number; description?: string; lineNo: number }> = [];
  for (const line of bill.lines) {
    lines.push({ accountId: line.accountId!, debit: Number(line.amount), credit: 0, description: line.description ?? undefined, lineNo: lines.length });
    const gst = Number(line.gstAmount);
    if (gst > 0) {
      const cgstAmount = Math.round(gst * 50) / 100;
      lines.push({ accountId: cgst!.id, debit: cgstAmount, credit: 0, description: 'Input CGST', lineNo: lines.length });
      lines.push({ accountId: sgst!.id, debit: Number((gst - cgstAmount).toFixed(2)), credit: 0, description: 'Input SGST', lineNo: lines.length });
    }
  }
  lines.push({ accountId: payable.id, debit: 0, credit: Number(bill.totalAmount), description: `Bill ${bill.billNo} payable`, lineNo: lines.length });
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  if (Math.abs(totalDebit - Number(bill.totalAmount)) > 0.001) throw new BillPostingError('not_balanced');

  const fyKey = getFiscalYear(bill.billDate, settings?.fiscalYearStartMonth ?? 4).replace('-', '');
  const existing = await tx.journalEntry.findMany({
    where: { tenantId, entryNo: { startsWith: `JE-${fyKey}-` } },
    select: { entryNo: true },
  });
  const lastNo = existing.reduce((max, entry) => Math.max(max, Number(entry.entryNo?.match(/^JE-\d{6,8}-(\d+)$/)?.[1] ?? 0)), 0);
  const entryNo = `JE-${fyKey}-${String(lastNo + 1).padStart(4, '0')}`;
  const entry = await tx.journalEntry.create({
    data: {
      tenantId, appType, branchId: bill.branchId, entryDate: bill.billDate, entryNo,
      narration: `Bill ${bill.billNo} — ${bill.vendor.name}`,
      sourceType: 'bill', sourceId: billId, dedupKey: buildDedupKey('bill', tenantId, billId),
      status: 'posted', createdById: actorId, totalDebit, totalCredit: Number(bill.totalAmount),
      lines: { create: lines },
    },
  });
  for (const line of lines) await bumpAccountBalance(tx, line.accountId, bill.billDate, line.debit, line.credit);
  const changed = await tx.bill.updateMany({
    where: { id: billId, tenantId, appType, status: expectedStatus },
    data: { status: 'unpaid', journalEntryId: entry.id },
  });
  if (changed.count !== 1) throw new BillPostingError('Already posted');
  await tx.accountingAuditLog.create({
    data: { tenantId, appType, branchId: bill.branchId, userId: actorId, action: 'post', entityType: 'bill', entityId: billId, after: JSON.stringify({ journalEntryId: entry.id }) },
  });
  return entry;
}

/** Settle a posted bill and write its payment journal in one transaction. */
export async function payBillInTx(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    appType: string;
    branchId: string | null;
    billId: string;
    actorId: string;
    amount: number;
    tdsAmount?: number;
    date: Date;
    payFromAccountId: string;
    reference?: string;
    narration?: string;
  },
) {
  const { tenantId, appType, branchId, billId, actorId } = input;
  if (typeof billId !== 'string' || !billId) throw new BillPostingError('Bill not found');
  const bill = await tx.bill.findFirst({
    where: {
      id: billId, tenantId, appType,
      ...(branchId ? { branchId } : {}),
      status: { in: ['unpaid', 'partial'] },
    },
    include: { vendor: true },
  });
  if (!bill || bill.vendor.tenantId !== tenantId || bill.vendor.appType !== appType ||
      bill.vendor.branchId !== bill.branchId) throw new BillPostingError('Bill not found');
  const tdsAmount = input.tdsAmount ?? 0;
  const outstanding = Number(bill.totalAmount) - Number(bill.paidAmount);
  const payment = calculateBillPayment(input.amount, tdsAmount, outstanding);
  if (!(input.date instanceof Date) || Number.isNaN(input.date.getTime()) ||
      typeof input.payFromAccountId !== 'string' || !input.payFromAccountId) {
    throw new BillPostingError('Invalid payment date or account');
  }
  const settings = await tx.accountingSettings.findUnique({ where: { tenantId } });
  if (!settings) throw new BillPostingError('Accounting settings not found');
  if (!settings?.allowFutureDated && input.date.getTime() > Date.now()) {
    throw new BillPostingError('Future-dated payments are disabled');
  }
  const period = await tx.accountingPeriod.findFirst({
    where: { tenantId, appType, periodKey: getPeriodKey(input.date) },
    select: { status: true },
  });
  if (period && ['locked', 'closed'].includes(period.status)) throw new BillPostingError('period_locked');

  let overrides: Record<string, string> = {};
  try {
    const parsed = JSON.parse(settings?.postingOverrides || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) overrides = parsed;
  } catch { /* Legacy malformed settings use canonical defaults. */ }
  const code = (key: 'vendor_payable' | 'tds_payable') =>
    typeof overrides[key] === 'string' && overrides[key].trim()
      ? overrides[key].trim() : POSTING_DEFAULTS[key];
  const [payable, tds, paymentAccount] = await Promise.all([
    tx.account.findFirst({ where: { tenantId, code: code('vendor_payable'), isActive: true }, select: { id: true } }),
    tdsAmount > 0
      ? tx.account.findFirst({ where: { tenantId, code: code('tds_payable'), isActive: true }, select: { id: true } })
      : Promise.resolve(null),
    tx.account.findFirst({
      where: { id: input.payFromAccountId, tenantId, isActive: true, subType: { in: ['cash', 'bank'] } },
      select: { id: true },
    }),
  ]);
  if (!payable || !paymentAccount || (tdsAmount > 0 && (!tds || !bill.vendor.tdsSection))) {
    throw new BillPostingError('account_invalid');
  }
  const nextPaid = Number(bill.paidAmount) + input.amount;
  const nextStatus = nextPaid + 0.001 >= Number(bill.totalAmount) ? 'paid' : 'partial';
  const changed = await tx.bill.updateMany({
    where: { id: billId, tenantId, appType, status: bill.status, paidAmount: bill.paidAmount },
    data: { paidAmount: nextPaid, tdsAmount: { increment: tdsAmount }, status: nextStatus },
  });
  if (changed.count !== 1) throw new BillPostingError('Bill payment changed concurrently');

  const bankAmount = payment.bankAmount;
  const lines = [
    { accountId: payable.id, debit: input.amount, credit: 0, lineNo: 0 },
    ...(tdsAmount > 0 ? [{ accountId: tds!.id, debit: 0, credit: tdsAmount, lineNo: 1 }] : []),
    { accountId: paymentAccount.id, debit: 0, credit: bankAmount, lineNo: tdsAmount > 0 ? 2 : 1 },
  ];
  const fyKey = getFiscalYear(input.date, settings.fiscalYearStartMonth).replace('-', '');
  const existing = await tx.journalEntry.findMany({
    where: { tenantId, entryNo: { startsWith: `JE-${fyKey}-` } },
    select: { entryNo: true },
  });
  const lastNo = existing.reduce((max, entry) => Math.max(max, Number(entry.entryNo?.match(/^JE-\d{6,8}-(\d+)$/)?.[1] ?? 0)), 0);
  const entryNo = `JE-${fyKey}-${String(lastNo + 1).padStart(4, '0')}`;
  const entry = await tx.journalEntry.create({
    data: {
      tenantId, appType, branchId: bill.branchId, entryDate: input.date, entryNo,
      narration: input.narration || `Payment for ${bill.billNo}`,
      sourceType: 'bill_payment', sourceId: billId, status: 'posted',
      createdById: actorId, totalDebit: input.amount, totalCredit: input.amount,
      lines: { create: lines },
    },
  });
  for (const line of lines) {
    await bumpAccountBalance(tx, line.accountId, input.date, line.debit, line.credit);
  }
  if (tdsAmount > 0) {
    await tx.tdsDeduction.create({
      data: {
        tenantId, appType, billId, vendorId: bill.vendorId,
        section: bill.vendor.tdsSection!, rate: bill.vendor.tdsRate ?? 0,
        baseAmount: input.amount, tdsAmount,
        periodKey: getPeriodKey(input.date), status: 'deducted',
      },
    });
  }
  await tx.accountingAuditLog.create({
    data: {
      tenantId, appType, branchId: bill.branchId, userId: actorId,
      action: 'pay', entityType: 'bill', entityId: billId,
      after: JSON.stringify({ paymentJEId: entry.id, reference: input.reference || null }),
    },
  });
  return entry;
}
