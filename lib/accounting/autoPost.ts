/**
 * autoPost.ts
 * Auto-creates JournalEntry records from operational events (loan disburse, collection, expense).
 * Called fire-and-forget from operational actions after the main DB write succeeds.
 * Safe to fail silently — premium JEs are supplemental to operational records.
 */
import { prisma } from '@/lib/db';
import { isPremiumAccountingEnabled } from './premium';

type Tx = typeof prisma;

async function getAcctId(tenantId: string, code: string): Promise<string | null> {
  const a = await prisma.account.findUnique({
    where: { tenantId_code: { tenantId, code } },
    select: { id: true },
  });
  return a?.id ?? null;
}

async function ensureJeNotDuplicate(tenantId: string, tag: string): Promise<boolean> {
  const existing = await prisma.journalEntry.count({
    where: { tenantId, narration: { contains: tag } },
  });
  return existing === 0; // true = safe to post
}

/**
 * Post JE for a loan disbursement.
 * Dr Loan Principal Receivable (1310) / Cr Cash on Hand (1100) or Bank (1200)
 */
export async function autoPostLoanDisburse(opts: {
  tenantId: string;
  loanId: string;
  loanCode: string;
  amount: number;
  date: Date;
  branchId?: string | null;
  createdById?: string | null;
  category?: string; // 'cash' | 'bank' | 'upi'
}) {
  try {
    const enabled = await isPremiumAccountingEnabled(opts.tenantId);
    if (!enabled) return;

    const tag = `[AUTO:disburse:${opts.loanId}]`;
    if (!(await ensureJeNotDuplicate(opts.tenantId, tag))) return; // already posted

    const useBank = ['bank','upi','neft','rtgs','imps'].includes(opts.category ?? '');
    const [lrId, cashId, bankId] = await Promise.all([
      getAcctId(opts.tenantId, '1310'), // Loan Principal Receivable
      getAcctId(opts.tenantId, '1100'), // Cash on Hand
      getAcctId(opts.tenantId, '1200'), // Bank Accounts
    ]);

    const creditAcctId = useBank ? (bankId ?? cashId) : cashId;
    if (!lrId || !creditAcctId) return; // CoA not seeded — skip silently

    const narration = `Loan ${opts.loanCode} disbursed ${tag}`;
    await prisma.journalEntry.create({
      data: {
        tenantId: opts.tenantId,
        entryDate: opts.date,
        narration,
        status: 'posted',
        sourceType: 'loan_disburse',
        branchId: opts.branchId ?? null,
        createdById: opts.createdById ?? (await getSystemUserId(opts.tenantId)),
        lines: {
          create: [
            { accountId: lrId,          debit: opts.amount, credit: 0,           description: narration, lineNo: 1 },
            { accountId: creditAcctId,  debit: 0,           credit: opts.amount, description: narration, lineNo: 2 },
          ],
        },
      },
    });
  } catch (e) {
    console.error('[autoPost] loan disburse JE failed:', e);
  }
}

/**
 * Post JE for a verified collection.
 * Dr Cash/Bank (1100/1200) / Cr Loan Principal Receivable (1310)
 * Note: basic accounting doesn't split principal/interest, so full amount hits 1310.
 */
export async function autoPostCollection(opts: {
  tenantId: string;
  entryId: string;
  loanId: string;
  loanCode: string;
  amount: number;
  date: Date;
  branchId?: string | null;
  createdById?: string | null;
  paymentMode?: string; // 'cash' | 'upi' | 'bank' | 'online'
}) {
  try {
    const enabled = await isPremiumAccountingEnabled(opts.tenantId);
    if (!enabled) return;

    const tag = `[AUTO:collect:${opts.entryId}]`;
    if (!(await ensureJeNotDuplicate(opts.tenantId, tag))) return;

    const useBank = ['upi','bank','online','neft','rtgs','imps'].includes(opts.paymentMode ?? '');
    const [cashId, bankId, lrId] = await Promise.all([
      getAcctId(opts.tenantId, '1100'),
      getAcctId(opts.tenantId, '1200'),
      getAcctId(opts.tenantId, '1310'),
    ]);

    const debitAcctId = useBank ? (bankId ?? cashId) : cashId;
    if (!debitAcctId || !lrId) return;

    const narration = `Collection for loan ${opts.loanCode} ${tag}`;
    await prisma.journalEntry.create({
      data: {
        tenantId: opts.tenantId,
        entryDate: opts.date,
        narration,
        status: 'posted',
        sourceType: 'collection',
        branchId: opts.branchId ?? null,
        createdById: opts.createdById ?? (await getSystemUserId(opts.tenantId)),
        lines: {
          create: [
            { accountId: debitAcctId, debit: opts.amount, credit: 0,           description: narration, lineNo: 1 },
            { accountId: lrId,        debit: 0,           credit: opts.amount, description: narration, lineNo: 2 },
          ],
        },
      },
    });
  } catch (e) {
    console.error('[autoPost] collection JE failed:', e);
  }
}

/**
 * Post JE for an expense.
 * Dr Other Expenses (5900) / Cr Cash (1100)
 */
export async function autoPostExpense(opts: {
  tenantId: string;
  entryId: string;
  description: string;
  amount: number;
  date: Date;
  branchId?: string | null;
  createdById?: string | null;
  category?: string;
}) {
  try {
    const enabled = await isPremiumAccountingEnabled(opts.tenantId);
    if (!enabled) return;

    const tag = `[AUTO:expense:${opts.entryId}]`;
    if (!(await ensureJeNotDuplicate(opts.tenantId, tag))) return;

    const useBank = ['bank','upi'].includes(opts.category ?? '');
    const [expId, cashId, bankId] = await Promise.all([
      getAcctId(opts.tenantId, '5900'),
      getAcctId(opts.tenantId, '1100'),
      getAcctId(opts.tenantId, '1200'),
    ]);

    const creditAcctId = useBank ? (bankId ?? cashId) : cashId;
    if (!expId || !creditAcctId) return;

    const narration = `${opts.description || 'Expense'} ${tag}`;
    await prisma.journalEntry.create({
      data: {
        tenantId: opts.tenantId,
        entryDate: opts.date,
        narration,
        status: 'posted',
        sourceType: 'expense',
        branchId: opts.branchId ?? null,
        createdById: opts.createdById ?? (await getSystemUserId(opts.tenantId)),
        lines: {
          create: [
            { accountId: expId,        debit: opts.amount, credit: 0,           description: narration, lineNo: 1 },
            { accountId: creditAcctId, debit: 0,           credit: opts.amount, description: narration, lineNo: 2 },
          ],
        },
      },
    });
  } catch (e) {
    console.error('[autoPost] expense JE failed:', e);
  }
}

/** Fallback: get any active admin/superadmin user for the tenant to use as createdBy */
async function getSystemUserId(tenantId: string): Promise<string> {
  const u = await prisma.user.findFirst({
    where: { tenantId, role: { in: ['superadmin', 'admin', 'developer'] } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!u) throw new Error('No admin user found for tenant');
  return u.id;
}
