import prisma from '@/lib/db';
import { z } from 'zod';
import { BillPostingError, calculateBillTotals, payBillInTx, postBillInTx } from '@/lib/accounting/bills';
import { getOrCreateAccountingSettings } from '@/lib/accounting/premium';
import {
  assertPremiumAccountingAccess,
  PremiumAccountingActor,
  PremiumAccountingServiceError,
} from '@/lib/accounting/premiumMobileService';

export type VendorInput = {
  name?: string; gstin?: string; pan?: string; email?: string; phone?: string;
  address?: string; tdsSection?: string; tdsRate?: number;
  bankName?: string; bankAccountNo?: string; bankIfsc?: string;
};

const vendorSchema = z.object({
  name: z.string().max(255), gstin: z.string(), pan: z.string(),
  email: z.string(), phone: z.string(), address: z.string(),
  tdsSection: z.string(), tdsRate: z.number(), bankName: z.string(),
  bankAccountNo: z.string(), bankIfsc: z.string(),
}).partial().strict();

const billSchema = z.object({
  vendorId: z.string().min(1), billNo: z.string().min(1),
  billDate: z.string().min(1), dueDate: z.string().min(1),
  category: z.string().optional(), description: z.string().optional(),
  lines: z.array(z.object({
    accountId: z.string().min(1), description: z.string().optional(),
    amount: z.number(), gstRate: z.number().optional(),
  }).strict()).min(1),
}).strict();

const paymentSchema = z.object({
  action: z.literal('pay').optional(),
  amount: z.number(), date: z.string().min(1), payFromAccountId: z.string().min(1),
  tdsAmount: z.number().optional(), reference: z.string().optional(),
  narration: z.string().optional(),
}).strict();

export function parseVendorInput(input: unknown): VendorInput {
  const result = vendorSchema.safeParse(input);
  if (!result.success) throw new PremiumAccountingServiceError('Invalid vendor input', 400);
  return result.data;
}

export function parseBillInput(input: unknown): BillInput {
  const result = billSchema.safeParse(input);
  if (!result.success) throw new PremiumAccountingServiceError('Invalid bill input', 400);
  return result.data;
}

export function parseBillPayment(input: unknown) {
  const result = paymentSchema.safeParse(input);
  if (!result.success) throw new PremiumAccountingServiceError('Invalid payment input', 400);
  return result.data;
}

function requireWriter(actor: PremiumAccountingActor) {
  if (!['admin', 'superadmin', 'developer'].includes(actor.role)) {
    throw new PremiumAccountingServiceError('Insufficient role', 403);
  }
}

function requireReviewer(actor: PremiumAccountingActor) {
  if (!['superadmin', 'developer'].includes(actor.role)) {
    throw new PremiumAccountingServiceError('Insufficient role', 403);
  }
}

function branchWhere(actor: PremiumAccountingActor) {
  return actor.branchId ? { branchId: actor.branchId } : {};
}

function validateVendor(input: VendorInput, creating: boolean) {
  if (creating && (!input.name || !input.name.trim())) throw new PremiumAccountingServiceError('Vendor name is required', 400);
  if (input.name !== undefined && (!input.name.trim() || input.name.length > 255)) {
    throw new PremiumAccountingServiceError('Invalid vendor name', 400);
  }
  if (input.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(input.gstin)) {
    throw new PremiumAccountingServiceError('gstin_invalid', 400);
  }
  if (input.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(input.pan)) {
    throw new PremiumAccountingServiceError('pan_invalid', 400);
  }
  if (input.tdsRate !== undefined && (!Number.isFinite(input.tdsRate) || input.tdsRate < 0 || input.tdsRate > 1)) {
    throw new PremiumAccountingServiceError('Invalid TDS rate', 400);
  }
}

export async function listVendors(actor: PremiumAccountingActor, filter: {
  isActive?: boolean | null; search?: string; page?: number;
} = {}) {
  await assertPremiumAccountingAccess(actor);
  if (filter.page !== undefined && (!Number.isSafeInteger(filter.page) || filter.page < 1)) {
    throw new PremiumAccountingServiceError('Invalid page', 400);
  }
  const where = {
    tenantId: actor.tenantId, appType: actor.appType, ...branchWhere(actor),
    isActive: filter.isActive === null ? undefined : filter.isActive ?? true,
    ...(filter.search ? { name: { contains: filter.search.trim() } } : {}),
  };
  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      include: {
        bills: { where: { appType: actor.appType, status: { in: ['unpaid', 'partial'] } },
          select: { totalAmount: true, paidAmount: true } },
        _count: { select: { bills: true } },
      },
      orderBy: { name: 'asc' },
      ...(filter.page ? { skip: (filter.page - 1) * 50, take: 50 } : {}),
    }),
    filter.page ? prisma.vendor.count({ where }) : Promise.resolve(0),
  ]);
  const rows = vendors.map((vendor) => ({
    id: vendor.id, name: vendor.name, gstin: vendor.gstin, pan: vendor.pan,
    phone: vendor.phone, email: vendor.email, tdsSection: vendor.tdsSection,
    isActive: vendor.isActive,
    openAP: vendor.bills.reduce((sum, bill) =>
      sum + Number(bill.totalAmount) - Number(bill.paidAmount), 0),
    outstanding: vendor.bills.reduce((sum, bill) =>
      sum + Number(bill.totalAmount) - Number(bill.paidAmount), 0),
    openBillCount: vendor.bills.length,
    billCount: vendor._count.bills,
  }));
  return filter.page ? { rows, total, page: filter.page, pages: Math.ceil(total / 50) } : rows;
}

export async function getVendor(actor: PremiumAccountingActor, id: string) {
  await assertPremiumAccountingAccess(actor);
  if (typeof id !== 'string' || !id) throw new PremiumAccountingServiceError('Vendor not found', 404);
  const vendor = await prisma.vendor.findFirst({
    where: { id, tenantId: actor.tenantId, appType: actor.appType, ...branchWhere(actor) },
  });
  if (!vendor) throw new PremiumAccountingServiceError('Vendor not found', 404);
  return vendor;
}

export async function createVendor(actor: PremiumAccountingActor, input: VendorInput) {
  await assertPremiumAccountingAccess(actor);
  requireWriter(actor);
  input = parseVendorInput(input);
  if (!actor.branchId) throw new PremiumAccountingServiceError('An active branch is required', 400);
  validateVendor(input, true);
  return prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.create({
      data: {
        tenantId: actor.tenantId, appType: actor.appType, branchId: actor.branchId,
        name: input.name!.trim(), gstin: input.gstin || null, pan: input.pan || null,
        email: input.email || null, phone: input.phone || null, address: input.address || null,
        tdsSection: input.tdsSection || null, tdsRate: input.tdsRate,
        bankName: input.bankName || null, bankAccountNo: input.bankAccountNo || null,
        bankIfsc: input.bankIfsc || null,
      },
    });
    await tx.accountingAuditLog.create({
      data: { tenantId: actor.tenantId, appType: actor.appType, branchId: actor.branchId,
        userId: actor.userId, action: 'create', entityType: 'vendor', entityId: vendor.id,
        after: JSON.stringify({ name: vendor.name }) },
    });
    return vendor;
  });
}

export async function updateVendor(actor: PremiumAccountingActor, id: string, input: VendorInput) {
  await assertPremiumAccountingAccess(actor);
  requireWriter(actor);
  await getVendor(actor, id);
  input = parseVendorInput(input);
  validateVendor(input, false);
  const allowed: VendorInput = {};
  for (const key of [
    'name', 'gstin', 'pan', 'email', 'phone', 'address', 'tdsSection',
    'tdsRate', 'bankName', 'bankAccountNo', 'bankIfsc',
  ] as const) {
    if (input[key] !== undefined) (allowed as Record<string, unknown>)[key] = input[key];
  }
  if (Object.keys(allowed).length === 0) throw new PremiumAccountingServiceError('No vendor changes', 400);
  return prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.update({ where: { id }, data: allowed });
    await tx.accountingAuditLog.create({
      data: { tenantId: actor.tenantId, appType: actor.appType, branchId: vendor.branchId,
        userId: actor.userId, action: 'update', entityType: 'vendor', entityId: id },
    });
    return vendor;
  });
}

export async function deactivateVendor(actor: PremiumAccountingActor, id: string) {
  await assertPremiumAccountingAccess(actor);
  requireReviewer(actor);
  const vendor = await getVendor(actor, id);
  await prisma.$transaction(async (tx) => {
    await tx.vendor.update({ where: { id }, data: { isActive: false } });
    await tx.accountingAuditLog.create({
      data: { tenantId: actor.tenantId, appType: actor.appType, branchId: vendor.branchId,
        userId: actor.userId, action: 'delete', entityType: 'vendor', entityId: id },
    });
  });
}

export async function listBills(actor: PremiumAccountingActor, input: {
  vendorId?: string; status?: string; search?: string; page?: number;
} = {}) {
  await assertPremiumAccountingAccess(actor);
  if (input.page !== undefined && (!Number.isSafeInteger(input.page) || input.page < 1)) {
    throw new PremiumAccountingServiceError('Invalid page', 400);
  }
  if (input.vendorId) await getVendor(actor, input.vendorId);
  const where = {
    tenantId: actor.tenantId, appType: actor.appType, ...branchWhere(actor),
    ...(input.vendorId ? { vendorId: input.vendorId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.search ? { billNo: { contains: input.search.trim() } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.bill.findMany({
      where,
      include: { vendor: { select: { id: true, name: true } } },
      orderBy: { billDate: 'desc' },
      ...(input.page ? { skip: (input.page - 1) * 50, take: 50 } : {}),
    }),
    input.page ? prisma.bill.count({ where }) : Promise.resolve(0),
  ]);
  return input.page ? { rows, total, page: input.page, pages: Math.ceil(total / 50) } : rows;
}

export async function getBill(actor: PremiumAccountingActor, id: string) {
  await assertPremiumAccountingAccess(actor);
  if (typeof id !== 'string' || !id) throw new PremiumAccountingServiceError('Bill not found', 404);
  const bill = await prisma.bill.findFirst({
    where: { id, tenantId: actor.tenantId, appType: actor.appType, ...branchWhere(actor) },
    include: { vendor: true, lines: { orderBy: { lineNo: 'asc' } }, tdsDeductions: true },
  });
  if (!bill || bill.vendor.tenantId !== actor.tenantId || bill.vendor.appType !== actor.appType ||
      bill.vendor.branchId !== bill.branchId) throw new PremiumAccountingServiceError('Bill not found', 404);
  const accounts = await prisma.account.findMany({
    where: { tenantId: actor.tenantId, id: { in: bill.lines.map((line) => line.accountId).filter((id): id is string => !!id) } },
    select: { id: true, code: true, name: true },
  });
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  return { ...bill, lines: bill.lines.map((line) => ({ ...line, account: accountMap.get(line.accountId || '') ?? null })) };
}

export type BillInput = {
  vendorId: string; billNo: string; billDate: string; dueDate: string;
  category?: string; description?: string;
  lines: Array<{ accountId: string; description?: string; amount: number; gstRate?: number }>;
};

export async function createBill(actor: PremiumAccountingActor, input: BillInput) {
  await assertPremiumAccountingAccess(actor);
  requireWriter(actor);
  input = parseBillInput(input);
  const vendor = await getVendor(actor, input.vendorId);
  if (!vendor.isActive || !vendor.branchId) throw new PremiumAccountingServiceError('Vendor not found', 404);
  if (typeof input.billNo !== 'string' || !input.billNo.trim() || !Array.isArray(input.lines) || input.lines.length === 0) {
    throw new PremiumAccountingServiceError('bill_no_lines', 400);
  }
  const billDate = new Date(input.billDate);
  const dueDate = new Date(input.dueDate);
  if (Number.isNaN(billDate.getTime()) || Number.isNaN(dueDate.getTime()) || dueDate < billDate) {
    throw new PremiumAccountingServiceError('Invalid bill dates', 400);
  }
  let totals: ReturnType<typeof calculateBillTotals>;
  try {
    totals = calculateBillTotals(input.lines);
  } catch (error) {
    if (error instanceof BillPostingError) throw new PremiumAccountingServiceError(error.message, 400);
    throw error;
  }
  const lines = input.lines.map((line, lineNo) => {
    const rate = line.gstRate ?? 0;
    if (typeof line.accountId !== 'string' || !line.accountId) {
      throw new PremiumAccountingServiceError('Invalid bill line', 400);
    }
    return { accountId: line.accountId, description: line.description, amount: line.amount,
      gstRate: rate, gstAmount: totals.lineGstCents[lineNo] / 100, lineNo };
  });
  const accountIds = [...new Set(lines.map((line) => line.accountId))];
  const accountCount = await prisma.account.count({
    where: { tenantId: actor.tenantId, id: { in: accountIds }, isActive: true, classType: 'expense' },
  });
  if (accountCount !== accountIds.length) throw new PremiumAccountingServiceError('Account not found', 404);
  try {
    return await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.create({
        data: {
          tenantId: actor.tenantId, appType: actor.appType, branchId: vendor.branchId,
          vendorId: vendor.id, billNo: input.billNo.trim(), billDate, dueDate,
          category: input.category, description: input.description,
          subtotal: totals.subtotal, gstAmount: totals.gstAmount,
          totalAmount: totals.totalAmount,
          status: 'draft', lines: { create: lines },
        },
      });
      await tx.accountingAuditLog.create({
        data: { tenantId: actor.tenantId, appType: actor.appType, branchId: vendor.branchId,
          userId: actor.userId, action: 'create', entityType: 'bill', entityId: bill.id },
      });
      return bill;
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new PremiumAccountingServiceError('bill_no_duplicate', 409);
    }
    throw error;
  }
}

export async function postBill(actor: PremiumAccountingActor, id: string) {
  await assertPremiumAccountingAccess(actor);
  requireWriter(actor);
  const bill = await getBill(actor, id);
  if (bill.status !== 'draft') throw new PremiumAccountingServiceError('Already posted', 400);
  const settings = await getOrCreateAccountingSettings(actor.tenantId);
  if (actor.role === 'admin' && Number(bill.totalAmount) > Number(settings.adminBillCap)) {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.bill.updateMany({
        where: { id, tenantId: actor.tenantId, appType: actor.appType, status: 'draft' },
        data: { status: 'pending_approval' },
      });
      if (changed.count !== 1) throw new PremiumAccountingServiceError('Already posted', 400);
      await tx.accountingApproval.create({
        data: { tenantId: actor.tenantId, appType: actor.appType, branchId: bill.branchId,
          entityType: 'bill', entityId: id, amount: bill.totalAmount, level: 1,
          approverRole: 'superadmin', requestedById: actor.userId },
      });
    });
    return { pending: true };
  }
  try {
    const entry = await prisma.$transaction((tx) => postBillInTx(tx, {
      tenantId: actor.tenantId, appType: actor.appType, branchId: actor.branchId ?? null,
      billId: id, actorId: actor.userId, expectedStatus: 'draft',
    }));
    return { journalEntryId: entry.id };
  } catch (error) {
    if (error instanceof BillPostingError) throw new PremiumAccountingServiceError(error.message, 400);
    throw error;
  }
}

export async function payBill(actor: PremiumAccountingActor, id: string, input: {
  amount: number; date: string; payFromAccountId: string; tdsAmount?: number;
  reference?: string; narration?: string;
}) {
  await assertPremiumAccountingAccess(actor);
  requireWriter(actor);
  input = parseBillPayment(input);
  try {
    const entry = await prisma.$transaction((tx) => payBillInTx(tx, {
      tenantId: actor.tenantId, appType: actor.appType, branchId: actor.branchId ?? null,
      billId: id, actorId: actor.userId, amount: input.amount,
      tdsAmount: input.tdsAmount, date: new Date(input.date),
      payFromAccountId: input.payFromAccountId, reference: input.reference,
      narration: input.narration,
    }));
    return { paymentJEId: entry.id };
  } catch (error) {
    if (error instanceof BillPostingError) throw new PremiumAccountingServiceError(error.message, 400);
    throw error;
  }
}

export async function cancelBill(actor: PremiumAccountingActor, id: string) {
  await assertPremiumAccountingAccess(actor);
  requireReviewer(actor);
  const bill = await getBill(actor, id);
  if (bill.status !== 'draft') throw new PremiumAccountingServiceError('Posted bills require a reversal', 400);
  return prisma.$transaction(async (tx) => {
    const changed = await tx.bill.updateMany({
      where: { id, tenantId: actor.tenantId, appType: actor.appType, status: 'draft' },
      data: { status: 'cancelled' },
    });
    if (changed.count !== 1) throw new PremiumAccountingServiceError('Bill changed concurrently', 400);
    await tx.accountingAuditLog.create({
      data: { tenantId: actor.tenantId, appType: actor.appType, branchId: bill.branchId,
        userId: actor.userId, action: 'cancel', entityType: 'bill', entityId: id },
    });
    return { success: true };
  });
}

export async function getVendorAgeing(actor: PremiumAccountingActor) {
  await assertPremiumAccountingAccess(actor);
  const bills = await prisma.bill.findMany({
    where: { tenantId: actor.tenantId, appType: actor.appType, ...branchWhere(actor),
      status: { in: ['unpaid', 'partial'] } },
    include: { vendor: { select: { id: true, name: true } } },
  });
  const now = Date.now();
  const groups = new Map<string, { vendorId: string; name: string; b0: number; b30: number; b60: number; b90: number }>();
  for (const bill of bills) {
    const row = groups.get(bill.vendorId) ?? { vendorId: bill.vendorId, name: bill.vendor.name, b0: 0, b30: 0, b60: 0, b90: 0 };
    const overdueDays = bill.dueDate ? Math.floor((now - bill.dueDate.getTime()) / 86400000) : 0;
    const amount = Number(bill.totalAmount) - Number(bill.paidAmount);
    if (overdueDays <= 30) row.b0 += amount;
    else if (overdueDays <= 60) row.b30 += amount;
    else if (overdueDays <= 90) row.b60 += amount;
    else row.b90 += amount;
    groups.set(bill.vendorId, row);
  }
  return [...groups.values()].map((row) => ({
    ...row, total: row.b0 + row.b30 + row.b60 + row.b90,
  }));
}

export async function getVendorAccounts(actor: PremiumAccountingActor, kind: 'expense' | 'payment') {
  await assertPremiumAccountingAccess(actor);
  return prisma.account.findMany({
    where: { tenantId: actor.tenantId, isActive: true,
      ...(kind === 'expense' ? { classType: 'expense' } : { subType: { in: ['cash', 'bank'] } }) },
    select: { id: true, code: true, name: true }, orderBy: { code: 'asc' },
  });
}
