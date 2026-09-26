import type { Prisma } from '@prisma/client';
import { bumpAccountBalance } from './balances';
import { getFiscalYear } from './premium';
import { buildDedupKey, POSTING_DEFAULTS } from './postingKeys';

export class BillPostingError extends Error {}

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
