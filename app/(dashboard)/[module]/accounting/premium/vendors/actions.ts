'use server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { writeAuditLog, getFiscalYear, getFyStartMonth, getPeriodKey } from '@/lib/accounting/premium';
import { bumpAccountBalance } from '@/lib/accounting/balances';

const VENDOR_PAYABLE_CODE = '2110';
const INPUT_CGST_CODE = '1410';
const INPUT_SGST_CODE = '1420';
const INPUT_IGST_CODE = '1430';
const TDS_PAYABLE_CODE = '2210';

// ─── Vendor CRUD ─────────────────────────────────────────────────────────────

export async function listVendors(filter?: { isActive?: boolean; search?: string }) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const vendors = await prisma.vendor.findMany({
    where: {
      tenantId,
      isActive: filter?.isActive !== undefined ? filter.isActive : true,
      name: filter?.search ? { contains: filter.search } : undefined,
    },
    include: {
      bills: {
        where: { status: { in: ['unpaid', 'partial'] } },
        select: { totalAmount: true, paidAmount: true },
      },
      _count: { select: { bills: true } },
    },
    orderBy: { name: 'asc' },
  });

  return vendors.map(v => ({
    id: v.id,
    name: v.name,
    gstin: v.gstin,
    pan: v.pan,
    phone: v.phone,
    tdsSection: v.tdsSection,
    isActive: v.isActive,
    openAP: v.bills.reduce((s, b) => s + Number(b.totalAmount) - Number(b.paidAmount), 0),
    billCount: (v._count as any).bills,
  }));
}

export async function createVendor(input: {
  name: string;
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  address?: string;
  tdsSection?: string;
  tdsRate?: number;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
}) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['admin', 'superadmin', 'developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  if (input.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(input.gstin)) {
    return { ok: false, error: 'gstin_invalid' };
  }
  if (input.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(input.pan)) {
    return { ok: false, error: 'pan_invalid' };
  }

  const vendor = await prisma.vendor.create({
    data: {
      tenantId,
      name: input.name,
      gstin: input.gstin,
      pan: input.pan,
      email: input.email,
      phone: input.phone,
      address: input.address,
      tdsSection: input.tdsSection,
      tdsRate: input.tdsRate,
      bankName: input.bankName,
      bankAccountNo: input.bankAccountNo,
      bankIfsc: input.bankIfsc,
      isActive: true,
    },
  });

  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'create', entityType: 'vendor', entityId: vendor.id, after: { name: vendor.name } });
  return { ok: true, data: vendor };
}

export async function updateVendor(id: string, input: Partial<{
  name: string; gstin: string; pan: string; email: string; phone: string; address: string;
  tdsSection: string; tdsRate: number; bankName: string; bankAccountNo: string; bankIfsc: string;
}>) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['admin', 'superadmin', 'developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  if (input.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(input.gstin)) {
    return { ok: false, error: 'gstin_invalid' };
  }

  await prisma.vendor.update({ where: { id }, data: input });
  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'update', entityType: 'vendor', entityId: id });
  return { ok: true };
}

export async function deactivateVendor(id: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['superadmin', 'developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  await prisma.vendor.update({ where: { id }, data: { isActive: false } });
  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'delete', entityType: 'vendor', entityId: id });
  return { ok: true };
}

// ─── Bills ────────────────────────────────────────────────────────────────────

export async function listBills(filter?: { vendorId?: string; status?: string; search?: string }) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  return prisma.bill.findMany({
    where: {
      tenantId,
      vendorId: filter?.vendorId,
      status: filter?.status,
      billNo: filter?.search ? { contains: filter.search } : undefined,
    },
    include: {
      vendor: { select: { id: true, name: true } },
    },
    orderBy: { billDate: 'desc' },
  });
}

export async function getBill(id: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const bill = await prisma.bill.findFirst({
    where: { id, tenantId },
    include: {
      vendor: true,
      lines: { orderBy: { lineNo: 'asc' } },
      tdsDeductions: true,
    },
  });

  if (!bill) return null;

  // Resolve account names for lines
  const accountIds = bill.lines.map(l => l.accountId).filter(Boolean) as string[];
  const accounts = accountIds.length
    ? await prisma.account.findMany({ where: { id: { in: accountIds } }, select: { id: true, code: true, name: true } })
    : [];
  const accountMap = new Map(accounts.map(a => [a.id, a]));

  return {
    ...bill,
    lines: bill.lines.map(l => ({
      ...l,
      account: l.accountId ? (accountMap.get(l.accountId) ?? null) : null,
    })),
  };
}

export async function createBill(input: {
  vendorId: string;
  billNo: string;
  billDate: string;
  dueDate: string;
  category?: string;
  description?: string;
  lines: Array<{ accountId: string; description?: string; amount: number; gstRate?: number }>;
}) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['admin', 'superadmin', 'developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  const validLines = (input.lines ?? []).filter((line) => line.accountId && Number(line.amount) > 0);
  if (validLines.length === 0) return { ok: false, error: 'bill_no_lines' };

  const existing = await prisma.bill.findFirst({ where: { tenantId, billNo: input.billNo } });
  if (existing) return { ok: false, error: 'bill_no_duplicate' };

  const processedLines = validLines.map((l, i) => {
    const gstRate = l.gstRate ?? 0;
    const gstAmount = l.amount * gstRate / 100;
    return { accountId: l.accountId, description: l.description, amount: l.amount, gstRate, gstAmount, lineNo: i };
  });

  const subtotal = processedLines.reduce((s, l) => s + l.amount, 0);
  const gstAmount = processedLines.reduce((s, l) => s + l.gstAmount, 0);
  const totalAmount = subtotal + gstAmount;

  const bill = await prisma.bill.create({
    data: {
      tenantId,
      vendorId: input.vendorId,
      billNo: input.billNo,
      billDate: new Date(input.billDate),
      dueDate: new Date(input.dueDate),
      category: input.category,
      description: input.description,
      subtotal,
      gstAmount,
      totalAmount,
      status: 'draft',
      lines: {
        create: processedLines.map(l => ({
          accountId: l.accountId,
          description: l.description,
          amount: l.amount,
          gstRate: l.gstRate,
          gstAmount: l.gstAmount,
          lineNo: l.lineNo,
        })),
      },
    },
  });

  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'create', entityType: 'bill', entityId: bill.id });
  return { ok: true, data: bill };
}

export async function postBill(id: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['admin', 'superadmin', 'developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  const bill = await prisma.bill.findFirst({
    where: { id, tenantId },
    include: { vendor: true, lines: true },
  });
  if (!bill) return { ok: false, error: 'Not found' };
  if (bill.status !== 'draft') return { ok: false, error: 'Already posted' };

  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId } });
  const adminBillCap = Number(settings?.adminBillCap ?? 100000);
  if (role === 'admin' && Number(bill.totalAmount) > adminBillCap) {
    await prisma.bill.update({ where: { id }, data: { status: 'pending_approval' } });
    await prisma.accountingApproval.create({
      data: { tenantId, entityType: 'bill', entityId: id, amount: bill.totalAmount, level: 1, approverRole: 'superadmin', requestedById: session.user!.id! },
    });
    return { ok: true, data: { pending: true } };
  }

  const payableAcct = await prisma.account.findFirst({ where: { tenantId, code: VENDOR_PAYABLE_CODE } });
  const cgstAcct = await prisma.account.findFirst({ where: { tenantId, code: INPUT_CGST_CODE } });
  const sgstAcct = await prisma.account.findFirst({ where: { tenantId, code: INPUT_SGST_CODE } });
  if (!payableAcct) return { ok: false, error: 'Vendor payable account (2110) not found. Seed CoA first.' };

  // Fetch line accounts
  const accountIds = bill.lines.map(l => l.accountId).filter(Boolean) as string[];
  const lineAccounts = accountIds.length
    ? await prisma.account.findMany({ where: { id: { in: accountIds } }, select: { id: true } })
    : [];
  const lineAccountSet = new Set(lineAccounts.map(a => a.id));

  const jeLines: Array<{ accountId: string; debit: number; credit: number; description?: string; lineNo: number }> = [];

  for (const line of bill.lines) {
    if (!line.accountId || !lineAccountSet.has(line.accountId)) continue;
    jeLines.push({ accountId: line.accountId, debit: Number(line.amount), credit: 0, description: line.description ?? undefined, lineNo: jeLines.length });

    if (Number(line.gstAmount) > 0) {
      const half = Number(line.gstAmount) / 2;
      if (cgstAcct) jeLines.push({ accountId: cgstAcct.id, debit: half, credit: 0, description: 'Input CGST', lineNo: jeLines.length });
      if (sgstAcct) jeLines.push({ accountId: sgstAcct.id, debit: half, credit: 0, description: 'Input SGST', lineNo: jeLines.length });
    }
  }

  jeLines.push({ accountId: payableAcct.id, debit: 0, credit: Number(bill.totalAmount), description: `Bill ${bill.billNo} payable`, lineNo: jeLines.length });

  const fyKey = getFiscalYear(bill.billDate, await getFyStartMonth(tenantId)).replace('-', '');
  const count = await prisma.journalEntry.count({ where: { tenantId } });
  const entryNo = `JE-${fyKey}-${String(count + 1).padStart(4, '0')}`;

  const je = await prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.create({
      data: {
        tenantId,
        entryDate: bill.billDate,
        entryNo,
        narration: `Bill ${bill.billNo} — ${bill.vendor.name}`,
        sourceType: 'bill',
        sourceId: id,
        status: 'posted',
        createdById: session.user!.id!,
        totalDebit: Number(bill.totalAmount),
        totalCredit: Number(bill.totalAmount),
        lines: { create: jeLines },
      },
    });

    for (const line of jeLines) {
      await bumpAccountBalance(tx, line.accountId, bill.billDate, line.debit, line.credit);
    }

    await tx.bill.update({ where: { id }, data: { status: 'unpaid', journalEntryId: entry.id } });
    return entry;
  });

  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'post', entityType: 'bill', entityId: id, after: { journalEntryId: je.id } });
  return { ok: true, data: { journalEntryId: je.id } };
}

export async function payBill(id: string, input: {
  amount: number;
  date: string;
  payFromAccountId: string;
  tdsAmount?: number;
  reference?: string;
  narration?: string;
}) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const bill = await prisma.bill.findFirst({
    where: { id, tenantId },
    include: { vendor: true },
  });
  if (!bill) return { ok: false, error: 'Not found' };

  const outstanding = Number(bill.totalAmount) - Number(bill.paidAmount);
  if (input.amount > outstanding + 0.01) return { ok: false, error: 'overpayment' };

  const payableAcct = await prisma.account.findFirst({ where: { tenantId, code: VENDOR_PAYABLE_CODE } });
  const tdsAcct = await prisma.account.findFirst({ where: { tenantId, code: TDS_PAYABLE_CODE } });
  if (!payableAcct) return { ok: false, error: 'Vendor payable account (2110) not found.' };

  const tdsAmt = input.tdsAmount ?? 0;
  const bankAmt = input.amount - tdsAmt;
  const entryDate = new Date(input.date);

  const jeLines: Array<{ accountId: string; debit: number; credit: number; description?: string; lineNo: number }> = [
    { accountId: payableAcct.id, debit: input.amount, credit: 0, description: `Payment — Bill ${bill.billNo}`, lineNo: 0 },
  ];
  if (tdsAmt > 0 && tdsAcct) {
    jeLines.push({ accountId: tdsAcct.id, debit: 0, credit: tdsAmt, description: `TDS deducted ${bill.vendor.tdsSection ?? ''}`, lineNo: 1 });
  }
  jeLines.push({ accountId: input.payFromAccountId, debit: 0, credit: bankAmt, description: input.narration ?? `Payment for ${bill.billNo}`, lineNo: jeLines.length });

  const fyKey = getFiscalYear(entryDate, await getFyStartMonth(tenantId)).replace('-', '');
  const count = await prisma.journalEntry.count({ where: { tenantId } });
  const entryNo = `JE-${fyKey}-${String(count + 1).padStart(4, '0')}`;

  const je = await prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.create({
      data: {
        tenantId,
        entryDate,
        entryNo,
        narration: input.narration ?? `Pay ${bill.billNo} — ${bill.vendor.name}`,
        sourceType: 'bill_payment',
        sourceId: id,
        status: 'posted',
        createdById: session.user!.id!,
        totalDebit: input.amount,
        totalCredit: input.amount,
        lines: { create: jeLines },
      },
    });

    for (const line of jeLines) {
      await bumpAccountBalance(tx, line.accountId, entryDate, line.debit, line.credit);
    }

    const newPaid = Number(bill.paidAmount) + input.amount;
    const newStatus = newPaid + 0.01 >= Number(bill.totalAmount) ? 'paid' : 'partial';

    await tx.bill.update({
      where: { id },
      data: {
        paidAmount: newPaid,
        tdsAmount: { increment: tdsAmt },
        status: newStatus,
      },
    });

    if (tdsAmt > 0) {
      await tx.tdsDeduction.create({
        data: {
          tenantId,
          billId: id,
          vendorId: bill.vendorId,
          section: bill.vendor.tdsSection ?? '194Q',
          rate: bill.vendor.tdsRate ?? 0.1,
          baseAmount: input.amount,
          tdsAmount: tdsAmt,
          periodKey: getPeriodKey(entryDate),
          status: 'deducted',
        },
      });
    }

    return entry;
  });

  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'pay', entityType: 'bill', entityId: id, after: { paymentJEId: je.id } });
  return { ok: true, data: { paymentJEId: je.id } };
}

export async function cancelBill(id: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['superadmin', 'developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  const bill = await prisma.bill.findFirst({ where: { id, tenantId } });
  if (!bill) return { ok: false, error: 'Not found' };

  await prisma.bill.update({ where: { id }, data: { status: 'cancelled' } });
  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'cancel', entityType: 'bill', entityId: id });
  return { ok: true };
}

export async function getAgeingReport() {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const bills = await prisma.bill.findMany({
    where: { tenantId, status: { in: ['unpaid', 'partial'] } },
    include: { vendor: { select: { id: true, name: true } } },
  });

  const today = new Date();
  const vendorMap: Record<string, { name: string; b0: number; b30: number; b60: number; b90: number }> = {};

  for (const bill of bills) {
    const outstanding = Number(bill.totalAmount) - Number(bill.paidAmount);
    const daysPast = bill.dueDate ? Math.floor((today.getTime() - new Date(bill.dueDate).getTime()) / 86400000) : 0;
    const vid = bill.vendor.id;
    if (!vendorMap[vid]) vendorMap[vid] = { name: bill.vendor.name, b0: 0, b30: 0, b60: 0, b90: 0 };

    if (daysPast <= 30) vendorMap[vid].b0 += outstanding;
    else if (daysPast <= 60) vendorMap[vid].b30 += outstanding;
    else if (daysPast <= 90) vendorMap[vid].b60 += outstanding;
    else vendorMap[vid].b90 += outstanding;
  }

  return Object.entries(vendorMap).map(([vendorId, v]) => ({
    vendorId,
    name: v.name,
    b0: v.b0,
    b30: v.b30,
    b60: v.b60,
    b90: v.b90,
    total: v.b0 + v.b30 + v.b60 + v.b90,
  }));
}

export async function getExpenseAccounts() {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  return prisma.account.findMany({
    where: { tenantId, isActive: true, classType: 'expense' },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });
}

export async function getBankAccounts() {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  return prisma.account.findMany({
    where: { tenantId, isActive: true, subType: { in: ['cash', 'bank'] } },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });
}
