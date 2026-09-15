/**
 * autoPost.ts
 * Auto-creates JournalEntry records from operational events (loan disburse, collection, expense).
 * Called fire-and-forget from operational actions after the main DB write succeeds.
 * Safe to fail silently — premium JEs are supplemental to operational records.
 */
import { prisma } from '@/lib/db';
import { isPremiumAccountingEnabled, getOrCreateAccountingSettings } from './premium';
import { bumpAccountBalance } from './balances';
import { POSTING_DEFAULTS, buildDedupKey, isDuplicateJournalEntry, type PostingKey } from './postingKeys';
import { isInterestOnly } from '@/lib/loanCalculator';

type Tx = typeof prisma;

async function getAcctId(tenantId: string, code: string): Promise<string | null> {
  const a = await prisma.account.findUnique({
    where: { tenantId_code: { tenantId, code } },
    select: { id: true },
  });
  return a?.id ?? null;
}

/**
 * Resolve a posting key to a GL account code, honouring the tenant's
 * AccountingSettings.postingOverrides JSON. Malformed JSON falls back to
 * the seeded default codes.
 */
export async function resolveAccountCode(tenantId: string, key: PostingKey): Promise<string> {
  const settings = await getOrCreateAccountingSettings(tenantId);
  let overrides: Record<string, string> = {};
  try {
    overrides = JSON.parse(settings.postingOverrides || '{}');
  } catch {
    // malformed override JSON — use defaults
  }
  const code = overrides[key];
  return typeof code === 'string' && code.trim() ? code.trim() : POSTING_DEFAULTS[key];
}

/** getAcctId via posting key (override-aware). */
async function getAcctIdByKey(tenantId: string, key: PostingKey): Promise<string | null> {
  return getAcctId(tenantId, await resolveAccountCode(tenantId, key));
}

/**
 * Which account a collection credits. Interest-Only dues are interest, everything
 * else repays the receivable. Falls back to the receivable if the loan can't be read
 * so a lookup failure never misroutes money into an income account.
 */
async function resolveCollectionCreditKey(loanId: string): Promise<PostingKey> {
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { deductionType: true },
    });
    return isInterestOnly(loan?.deductionType) ? 'interest_income' : 'loan_receivable';
  } catch {
    return 'loan_receivable';
  }
}

/**
 * Legacy pre-check for entries written before `dedupKey` was populated, which
 * carried their identity only in the narration tag. Rows written since then are
 * protected by the UNIQUE index on `dedupKey` — see `isDuplicateJournalEntry`,
 * which is the authoritative guard because the database enforces it atomically.
 * This scan cannot: two concurrent callers can both read zero and both post.
 */
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
      getAcctIdByKey(opts.tenantId, 'loan_receivable'),
      getAcctIdByKey(opts.tenantId, 'cash_on_hand'),
      getAcctIdByKey(opts.tenantId, 'bank_account'),
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
        sourceId: opts.loanId,
        dedupKey: buildDedupKey('loan_disburse', opts.tenantId, opts.loanId),
        voucherType: 'Payment',
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
    
    await bumpAccountBalance(prisma as any, lrId, opts.date, opts.amount, 0);
    await bumpAccountBalance(prisma as any, creditAcctId, opts.date, 0, opts.amount);
  } catch (e) {
    if (isDuplicateJournalEntry(e)) return; // already posted — the unique index held
    console.error('[autoPost] loan disburse JE failed:', e);
  }
}

/**
 * Post JE for a verified collection.
 * Dr Cash/Bank (1100/1200) / Cr Loan Principal Receivable (1310)
 * Note: basic accounting doesn't split principal/interest, so full amount hits 1310.
 *
 * Exception: a collection against an Interest-Only loan is pure interest, so it
 * credits Interest Income (4100) instead — crediting the receivable would write the
 * ₹10L principal down as if it were being repaid, and keep the income off the P&L.
 * That's derived from the loan here rather than passed in, so no call site can forget
 * it. The principal closure passes `creditKey: 'loan_receivable'` to opt back out.
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
  creditKey?: PostingKey;
}) {
  try {
    const enabled = await isPremiumAccountingEnabled(opts.tenantId);
    if (!enabled) return;

    const tag = `[AUTO:collect:${opts.entryId}]`;
    if (!(await ensureJeNotDuplicate(opts.tenantId, tag))) return;

    const useBank = ['upi','bank','online','neft','rtgs','imps'].includes(opts.paymentMode ?? '');
    // Named for what it is rather than 'loan receivable' — on an Interest-Only loan
    // this resolves to Interest Income instead.
    const creditKey = opts.creditKey ?? (await resolveCollectionCreditKey(opts.loanId));
    const [cashId, bankId, creditAcctId] = await Promise.all([
      getAcctIdByKey(opts.tenantId, 'cash_on_hand'),
      getAcctIdByKey(opts.tenantId, 'bank_account'),
      getAcctIdByKey(opts.tenantId, creditKey),
    ]);

    const debitAcctId = useBank ? (bankId ?? cashId) : cashId;
    if (!debitAcctId || !creditAcctId) return;

    const narration = `Collection for loan ${opts.loanCode} ${tag}`;
    await prisma.journalEntry.create({
      data: {
        tenantId: opts.tenantId,
        entryDate: opts.date,
        narration,
        status: 'posted',
        sourceType: 'collection',
        sourceId: opts.entryId,
        dedupKey: buildDedupKey('collection', opts.tenantId, opts.entryId),
        voucherType: 'Receipt',
        branchId: opts.branchId ?? null,
        createdById: opts.createdById ?? (await getSystemUserId(opts.tenantId)),
        lines: {
          create: [
            { accountId: debitAcctId,  debit: opts.amount, credit: 0,           description: narration, lineNo: 1 },
            { accountId: creditAcctId, debit: 0,           credit: opts.amount, description: narration, lineNo: 2 },
          ],
        },
      },
    });

    await bumpAccountBalance(prisma as any, debitAcctId, opts.date, opts.amount, 0);
    await bumpAccountBalance(prisma as any, creditAcctId, opts.date, 0, opts.amount);
  } catch (e) {
    if (isDuplicateJournalEntry(e)) return; // already posted — the unique index held
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
      getAcctIdByKey(opts.tenantId, 'other_expenses'),
      getAcctIdByKey(opts.tenantId, 'cash_on_hand'),
      getAcctIdByKey(opts.tenantId, 'bank_account'),
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
        sourceId: opts.entryId,
        dedupKey: buildDedupKey('expense', opts.tenantId, opts.entryId),
        voucherType: 'Payment',
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
    
    await bumpAccountBalance(prisma as any, expId, opts.date, opts.amount, 0);
    await bumpAccountBalance(prisma as any, creditAcctId, opts.date, 0, opts.amount);
  } catch (e) {
    if (isDuplicateJournalEntry(e)) return; // already posted — the unique index held
    console.error('[autoPost] expense JE failed:', e);
  }
}

/**
 * Post JE for a capital addition.
 * Dr Cash/Bank (1100/1200) / Cr Owner's Capital (3100)
 */
export async function autoPostCapitalAdd(opts: {
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

    const tag = `[AUTO:capital_add:${opts.entryId}]`;
    if (!(await ensureJeNotDuplicate(opts.tenantId, tag))) return;

    const useBank = ['bank','upi'].includes(opts.category ?? '');
    const [capId, cashId, bankId] = await Promise.all([
      getAcctIdByKey(opts.tenantId, 'owners_capital'),
      getAcctIdByKey(opts.tenantId, 'cash_on_hand'),
      getAcctIdByKey(opts.tenantId, 'bank_account'),
    ]);

    const debitAcctId = useBank ? (bankId ?? cashId) : cashId;
    if (!capId || !debitAcctId) return;

    const narration = `${opts.description || 'Capital Addition'} ${tag}`;
    await prisma.journalEntry.create({
      data: {
        tenantId: opts.tenantId,
        entryDate: opts.date,
        narration,
        status: 'posted',
        sourceType: 'capital_add',
        sourceId: opts.entryId,
        dedupKey: buildDedupKey('capital_add', opts.tenantId, opts.entryId),
        voucherType: 'Receipt',
        branchId: opts.branchId ?? null,
        createdById: opts.createdById ?? (await getSystemUserId(opts.tenantId)),
        lines: {
          create: [
            { accountId: debitAcctId, debit: opts.amount, credit: 0,           description: narration, lineNo: 1 },
            { accountId: capId,       debit: 0,           credit: opts.amount, description: narration, lineNo: 2 },
          ],
        },
      },
    });
    
    await bumpAccountBalance(prisma as any, debitAcctId, opts.date, opts.amount, 0);
    await bumpAccountBalance(prisma as any, capId, opts.date, 0, opts.amount);
  } catch (e) {
    if (isDuplicateJournalEntry(e)) return; // already posted — the unique index held
    console.error('[autoPost] capital add JE failed:', e);
  }
}

/**
 * Post JE for a capital withdrawal.
 * Dr Owner's Capital (3100) / Cr Cash/Bank (1100/1200)
 */
export async function autoPostCapitalWithdraw(opts: {
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

    const tag = `[AUTO:capital_withdraw:${opts.entryId}]`;
    if (!(await ensureJeNotDuplicate(opts.tenantId, tag))) return;

    const useBank = ['bank','upi'].includes(opts.category ?? '');
    const [capId, cashId, bankId] = await Promise.all([
      getAcctIdByKey(opts.tenantId, 'owners_capital'),
      getAcctIdByKey(opts.tenantId, 'cash_on_hand'),
      getAcctIdByKey(opts.tenantId, 'bank_account'),
    ]);

    const creditAcctId = useBank ? (bankId ?? cashId) : cashId;
    if (!capId || !creditAcctId) return;

    const narration = `${opts.description || 'Capital Withdrawal'} ${tag}`;
    await prisma.journalEntry.create({
      data: {
        tenantId: opts.tenantId,
        entryDate: opts.date,
        narration,
        status: 'posted',
        sourceType: 'capital_withdraw',
        sourceId: opts.entryId,
        dedupKey: buildDedupKey('capital_withdraw', opts.tenantId, opts.entryId),
        voucherType: 'Payment',
        branchId: opts.branchId ?? null,
        createdById: opts.createdById ?? (await getSystemUserId(opts.tenantId)),
        lines: {
          create: [
            { accountId: capId,        debit: opts.amount, credit: 0,           description: narration, lineNo: 1 },
            { accountId: creditAcctId, debit: 0,           credit: opts.amount, description: narration, lineNo: 2 },
          ],
        },
      },
    });
    
    await bumpAccountBalance(prisma as any, capId, opts.date, opts.amount, 0);
    await bumpAccountBalance(prisma as any, creditAcctId, opts.date, 0, opts.amount);
  } catch (e) {
    if (isDuplicateJournalEntry(e)) return; // already posted — the unique index held
    console.error('[autoPost] capital withdraw JE failed:', e);
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
