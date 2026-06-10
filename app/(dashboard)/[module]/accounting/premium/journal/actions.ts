'use server';

import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import { revalidatePath } from 'next/cache';
import { bumpAccountBalance } from '@/lib/accounting/balances';
import { writeAuditLog, getPeriodKey, getFiscalYear, getFyStartMonth } from '@/lib/accounting/premium';

function requireRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) throw new Error('Unauthorized');
}

async function assignNextEntryNo(tenantId: string, entryDate: Date): Promise<string> {
  const fyStartMonth = await getFyStartMonth(tenantId); // 1-based
  const fy = getFiscalYear(entryDate, fyStartMonth);
  const fyKey = fy.replace('-', '');
  const startMonth = fyStartMonth - 1; // JS Date month index
  const fyStart = entryDate.getMonth() >= startMonth
    ? new Date(entryDate.getFullYear(), startMonth, 1)
    : new Date(entryDate.getFullYear() - 1, startMonth, 1);
  const existing = await prisma.journalEntry.findMany({
    where: { tenantId, entryNo: { startsWith: `JE-${fyKey}-` }, entryDate: { gte: fyStart } },
    select: { entryNo: true },
    orderBy: { entryNo: 'desc' },
    take: 50,
  });
  const max = existing.reduce((highest, entry) => {
    const next = Number(entry.entryNo?.match(/^JE-\d{6,8}-(\d+)$/)?.[1] ?? 0);
    return Number.isFinite(next) && next > highest ? next : highest;
  }, 0);
  return `JE-${fyKey}-${String(max + 1).padStart(4, '0')}`;
}

export async function listJournalEntries(filter?: { from?: string; to?: string; status?: string; search?: string; page?: number }) {
  const tenantId = await getDefaultTenantId();
  const branchId = await getActiveBranchId();
  const page = filter?.page ?? 1;
  const take = 50;
  const now = new Date();
  const from = filter?.from ? new Date(filter.from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = filter?.to ? new Date(filter.to) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const and: any[] = [];
  if (branchId) and.push({ OR: [{ branchId }, { branchId: null }] });
  if (filter?.search) and.push({ OR: [{ narration: { contains: filter.search } }, { entryNo: { contains: filter.search } }] });
  const where: any = {
    tenantId, entryDate: { gte: from, lte: to },
    ...(filter?.status ? { status: filter.status } : {}),
    ...(and.length ? { AND: and } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.journalEntry.findMany({ where, orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }], skip: (page-1)*take, take, include: { createdBy: { select: { name: true } } } }),
    prisma.journalEntry.count({ where }),
  ]);
  return { rows: JSON.parse(JSON.stringify(rows)), total, page, pages: Math.ceil(total / take) };
}

export async function getJournalEntry(id: string) {
  const tenantId = await getDefaultTenantId();
  const entry = await prisma.journalEntry.findFirst({
    where: { id, tenantId },
    include: {
      lines: { include: { account: { select: { code: true, name: true } } }, orderBy: { lineNo: 'asc' } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      reversedBy: { select: { id: true, entryNo: true } },
    },
  });
  return entry ? JSON.parse(JSON.stringify(entry)) : null;
}

export async function postEntry(input: { entryDate: string; narration?: string; branchId?: string; lines: Array<{ accountId: string; debit: number; credit: number; description?: string; lineNo: number }> }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id!;
  requireRole(role, ['admin', 'superadmin', 'developer']);
  const tenantId = await getDefaultTenantId();
  const entryDate = new Date(input.entryDate);
  const totalDr = input.lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCr = input.lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(totalDr - totalCr) > 0.01) return { error: 'not_balanced' };
  if (totalDr === 0) return { error: 'empty_entry' };
  if (input.lines.length < 2) return { error: 'min_lines' };
  const periodKey = getPeriodKey(entryDate);
  const period = await prisma.accountingPeriod.findUnique({ where: { tenantId_periodKey: { tenantId, periodKey } } });
  if (period && ['locked', 'closed'].includes(period.status) && role !== 'developer') return { error: 'period_locked' };
  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId } });
  const cap = role === 'admin' ? Number(settings?.adminJeCap ?? 50000) : Infinity;
  if (totalDr > cap) {
    const entry = await prisma.journalEntry.create({ data: { tenantId, branchId: input.branchId ?? null, entryDate, narration: input.narration, status: 'pending_approval', sourceType: 'manual', totalDebit: totalDr, totalCredit: totalCr, createdById: userId, lines: { create: input.lines.map((l) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit, description: l.description, lineNo: l.lineNo })) } } });
    await prisma.accountingApproval.create({ data: { tenantId, entityType: 'journal_entry', entityId: entry.id, amount: totalDr, level: 1, approverRole: 'superadmin', requestedById: userId } });
    revalidatePath('/accounting/premium/journal');
    return { success: true, status: 'pending_approval', entryId: entry.id };
  }
  const entryNo = await assignNextEntryNo(tenantId, entryDate);
  const entry = await prisma.$transaction(async (tx) => {
    const je = await tx.journalEntry.create({ data: { tenantId, branchId: input.branchId ?? null, entryNo, entryDate, narration: input.narration, status: 'posted', sourceType: 'manual', totalDebit: totalDr, totalCredit: totalCr, createdById: userId, approvedById: userId, approvedAt: new Date(), lines: { create: input.lines.map(l => ({ accountId: l.accountId, debit: l.debit, credit: l.credit, description: l.description, lineNo: l.lineNo })) } }, include: { lines: true } });
    for (const line of je.lines) await bumpAccountBalance(tx as any, line.accountId, entryDate, line.debit, line.credit);
    await tx.accountingAuditLog.create({ data: { tenantId, userId, action: 'post', entityType: 'journal_entry', entityId: je.id, after: JSON.stringify({ entryNo, totalDebit: totalDr }) } });
    return je;
  });
  revalidatePath('/accounting/premium/journal');
  return { success: true, entryId: entry.id, entryNo };
}

export async function saveDraftEntry(input: { entryDate: string; narration?: string; lines: Array<{ accountId: string; debit: number; credit: number; description?: string; lineNo: number }> }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id!;
  requireRole(role, ['admin', 'superadmin', 'developer']);
  const tenantId = await getDefaultTenantId();
  const entryDate = new Date(input.entryDate);
  const totalDr = input.lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCr = input.lines.reduce((s, l) => s + (l.credit || 0), 0);
  const entry = await prisma.journalEntry.create({ data: { tenantId, entryDate, narration: input.narration, status: 'draft', sourceType: 'manual', totalDebit: totalDr, totalCredit: totalCr, createdById: userId, lines: { create: input.lines.map((l, i) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit, description: l.description, lineNo: i })) } } });
  revalidatePath('/accounting/premium/journal');
  return { success: true, entryId: entry.id };
}

export async function postDraftEntry(id: string) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id!;
  requireRole(role, ['admin', 'superadmin', 'developer']);
  const tenantId = await getDefaultTenantId();
  const draft = await prisma.journalEntry.findFirst({ where: { id, tenantId, status: 'draft' }, include: { lines: true } });
  if (!draft) return { error: 'not_found' };
  const totalDr = draft.lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCr = draft.lines.reduce((s, l) => s + Number(l.credit), 0);
  if (Math.abs(totalDr - totalCr) > 0.01) return { error: 'not_balanced' };
  if (totalDr === 0) return { error: 'empty_entry' };
  if (draft.lines.length < 2) return { error: 'min_lines' };
  const periodKey = getPeriodKey(draft.entryDate);
  const period = await prisma.accountingPeriod.findUnique({ where: { tenantId_periodKey: { tenantId, periodKey } } });
  if (period && ['locked', 'closed'].includes(period.status) && role !== 'developer') return { error: 'period_locked' };
  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId } });
  const cap = role === 'admin' ? Number(settings?.adminJeCap ?? 50000) : Infinity;
  if (totalDr > cap) {
    await prisma.journalEntry.update({ where: { id }, data: { status: 'pending_approval' } });
    await prisma.accountingApproval.create({ data: { tenantId, entityType: 'journal_entry', entityId: id, amount: totalDr, level: 1, approverRole: 'superadmin', requestedById: userId } });
    revalidatePath('/accounting/premium/journal');
    return { success: true, status: 'pending_approval', entryId: id };
  }
  const entryNo = await assignNextEntryNo(tenantId, draft.entryDate);
  await prisma.$transaction(async (tx) => {
    await tx.journalEntry.update({ where: { id }, data: { status: 'posted', entryNo, approvedById: userId, approvedAt: new Date() } });
    for (const line of draft.lines) await bumpAccountBalance(tx as any, line.accountId, draft.entryDate, Number(line.debit), Number(line.credit));
    await tx.accountingAuditLog.create({ data: { tenantId, userId, action: 'post', entityType: 'journal_entry', entityId: id, after: JSON.stringify({ entryNo, totalDebit: totalDr }) } });
  });
  revalidatePath('/accounting/premium/journal');
  return { success: true, entryId: id, entryNo };
}

export async function deleteDraftEntry(id: string) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id!;
  requireRole(role, ['admin', 'superadmin', 'developer']);
  const tenantId = await getDefaultTenantId();
  const draft = await prisma.journalEntry.findFirst({ where: { id, tenantId, status: 'draft' } });
  if (!draft) return { error: 'not_found' };
  await prisma.journalLine.deleteMany({ where: { entryId: id } });
  await prisma.journalEntry.delete({ where: { id } });
  await writeAuditLog({ tenantId, userId, action: 'delete', entityType: 'journal_entry', entityId: id, reason: 'Deleted draft entry' });
  revalidatePath('/accounting/premium/journal');
  return { success: true };
}

export async function reverseEntry(id: string, reason: string) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id!;
  requireRole(role, ['superadmin', 'developer']);
  const tenantId = await getDefaultTenantId();
  const original = await prisma.journalEntry.findFirst({ where: { id, tenantId, status: 'posted' }, include: { lines: true } });
  if (!original) return { error: 'not_found' };
  const entryDate = new Date();
  const entryNo = await assignNextEntryNo(tenantId, entryDate);
  const periodKey = getPeriodKey(entryDate);
  const period = await prisma.accountingPeriod.findUnique({ where: { tenantId_periodKey: { tenantId, periodKey } } });
  if (period && ['locked', 'closed'].includes(period.status) && role !== 'developer') return { error: 'period_locked' };
  const reversal = await prisma.$transaction(async (tx) => {
    const rev = await tx.journalEntry.create({ data: { tenantId, entryNo, entryDate, narration: `Reversal of ${original.entryNo ?? id}: ${reason}`, status: 'posted', sourceType: 'reversal', sourceId: original.id, dedupKey: `reversal:${original.id}`, totalDebit: original.totalCredit, totalCredit: original.totalDebit, createdById: userId, approvedById: userId, approvedAt: new Date(), lines: { create: original.lines.map(l => ({ accountId: l.accountId, debit: l.credit, credit: l.debit, description: l.description, lineNo: l.lineNo })) } }, include: { lines: true } });
    await tx.journalEntry.update({ where: { id }, data: { status: 'reversed', reversedById: rev.id } });
    for (const line of rev.lines) await bumpAccountBalance(tx as any, line.accountId, entryDate, line.debit, line.credit);
    await tx.accountingAuditLog.create({ data: { tenantId, userId, action: 'reverse', entityType: 'journal_entry', entityId: id, after: JSON.stringify({ reversalId: rev.id, reason }) } });
    return rev;
  });
  revalidatePath('/accounting/premium/journal');
  return { success: true, reversalId: reversal.id };
}

export async function listActiveAccounts() {
  const tenantId = await getDefaultTenantId();
  return prisma.account.findMany({ where: { tenantId, isActive: true, deletedAt: null }, select: { id: true, code: true, name: true, classType: true }, orderBy: { code: 'asc' } });
}

export async function approveEntry(id: string) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id!;
  requireRole(role, ['superadmin', 'developer']);
  const tenantId = await getDefaultTenantId();
  const entry = await prisma.journalEntry.findFirst({ where: { id, tenantId, status: 'pending_approval' }, include: { lines: true } });
  if (!entry) return { error: 'not_found' };
  const entryNo = await assignNextEntryNo(tenantId, entry.entryDate);
  await prisma.$transaction(async (tx) => {
    await tx.journalEntry.update({ where: { id }, data: { status: 'posted', entryNo, approvedById: userId, approvedAt: new Date() } });
    for (const line of entry.lines) await bumpAccountBalance(tx as any, line.accountId, entry.entryDate, line.debit, line.credit);
    await tx.accountingApproval.updateMany({ where: { entityId: id, status: 'pending' }, data: { status: 'approved', approvedById: userId, reviewedAt: new Date() } });
    await tx.accountingAuditLog.create({ data: { tenantId, userId, action: 'approve', entityType: 'journal_entry', entityId: id, after: JSON.stringify({ entryNo }) } });
  });
  revalidatePath('/accounting/premium/journal');
  return { success: true };
}

export async function rejectEntry(id: string, note: string) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id!;
  requireRole(role, ['superadmin', 'developer']);
  const tenantId = await getDefaultTenantId();
  await prisma.journalEntry.update({ where: { id }, data: { status: 'rejected' } });
  await prisma.accountingApproval.updateMany({ where: { entityId: id, status: 'pending' }, data: { status: 'rejected', approvedById: userId, reviewNote: note, reviewedAt: new Date() } });
  await writeAuditLog({ tenantId, userId, action: 'reject', entityType: 'journal_entry', entityId: id, reason: note });
  revalidatePath('/accounting/premium/journal');
  return { success: true };
}
