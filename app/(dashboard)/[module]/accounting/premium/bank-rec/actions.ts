'use server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { writeAuditLog } from '@/lib/accounting/premium';

// List all bank accounts for this tenant
export async function listBankAccounts() {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const accounts = await prisma.bankAccount.findMany({
    where: { tenantId, isActive: true },
    include: {
      ledgerAccount: { select: { code: true, name: true } },
      statements: {
        orderBy: { statementTo: 'desc' },
        take: 1,
        select: { statementTo: true, status: true, closingBalance: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Get book balance (sum of journal lines for each ledger account)
  const result = await Promise.all(accounts.map(async (ba) => {
    const agg = await prisma.journalLine.aggregate({
      _sum: { debit: true, credit: true },
      where: { accountId: ba.ledgerAccountId, entry: { tenantId, status: 'posted' } },
    });
    const bookBalance = Number(ba.openingBalance) + Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0);
    return {
      id: ba.id,
      name: ba.name,
      bankName: ba.bankName,
      accountNo: ba.accountNo,
      ledgerCode: ba.ledgerAccount.code,
      ledgerName: ba.ledgerAccount.name,
      bookBalance,
      lastStatement: ba.statements[0] ?? null,
    };
  }));

  return result;
}

// Create a new bank account
export async function createBankAccount(input: {
  name: string;
  bankName: string;
  accountNo: string;
  ifsc?: string;
  ledgerAccountId: string;
  openingBalance: number;
  openingAsOf: string;
}) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['admin','superadmin','developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  const ba = await prisma.bankAccount.create({
    data: {
      tenantId,
      name: input.name,
      bankName: input.bankName,
      accountNo: input.accountNo,
      ifsc: input.ifsc,
      ledgerAccountId: input.ledgerAccountId,
      openingBalance: input.openingBalance,
      openingAsOf: new Date(input.openingAsOf),
    },
  });

  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'create', entityType: 'bank_statement', entityId: ba.id });
  return { ok: true, data: ba };
}

// Get bank account with statements
export async function getBankAccountDetail(bankAccountId: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  return prisma.bankAccount.findFirst({
    where: { id: bankAccountId, tenantId },
    include: {
      ledgerAccount: { select: { id: true, code: true, name: true } },
      statements: {
        orderBy: { statementFrom: 'desc' },
        include: {
          _count: { select: { lines: true } },
        },
      },
    },
  });
}

// Get statement with lines
export async function getStatementWithLines(statementId: string, showUnmatchedOnly = false) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const stmt = await prisma.bankStatement.findFirst({
    where: { id: statementId, bankAccount: { tenantId } },
    include: {
      lines: {
        where: showUnmatchedOnly ? { status: 'unmatched' } : undefined,
        orderBy: { postingDate: 'asc' },
        include: {
          matchedJournalLine: {
            include: { entry: { select: { entryNo: true, narration: true, entryDate: true } } },
          },
          proposals: {
            orderBy: { score: 'desc' },
            take: 3,
            select: { id: true, journalLineId: true, score: true, reason: true },
          },
        },
      },
      bankAccount: { select: { id: true, name: true, ledgerAccountId: true } },
    },
  });

  return stmt;
}

// Import a statement (simplified — parses CSV rows from client)
export async function importStatement(bankAccountId: string, rows: Array<{
  postingDate: string;
  description: string;
  reference?: string;
  debit: number;
  credit: number;
  runningBalance?: number;
}>, statementFrom: string, statementTo: string, openingBalance: number, closingBalance: number) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['admin','superadmin','developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  const ba = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, tenantId } });
  if (!ba) return { ok: false, error: 'Bank account not found' };

  // Check for overlap
  const existing = await prisma.bankStatement.findFirst({
    where: {
      bankAccountId,
      OR: [
        { statementFrom: { lte: new Date(statementTo) }, statementTo: { gte: new Date(statementFrom) } },
      ],
    },
  });
  if (existing) return { ok: false, error: 'Overlapping or duplicate statement already imported.' };

  const stmt = await prisma.bankStatement.create({
    data: {
      bankAccountId,
      fileName: `statement-${statementFrom}-${statementTo}.csv`,
      fileFormat: 'csv',
      statementFrom: new Date(statementFrom),
      statementTo: new Date(statementTo),
      openingBalance,
      closingBalance,
      importedById: session.user!.id!,
      lines: {
        create: rows.map(r => ({
          postingDate: new Date(r.postingDate),
          description: r.description,
          reference: r.reference,
          debit: r.debit,
          credit: r.credit,
          runningBalance: r.runningBalance,
        })),
      },
    },
  });

  // Auto-run matching
  await runMatching(stmt.id, ba.ledgerAccountId, tenantId);

  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'import_statement', entityType: 'bank_statement', entityId: stmt.id });
  return { ok: true, data: stmt };
}

// Matching engine
async function runMatching(statementId: string, ledgerAccountId: string, tenantId: string) {
  const lines = await prisma.bankStatementLine.findMany({
    where: { statementId, status: 'unmatched' },
  });

  for (const line of lines) {
    const lineAmt = Number(line.debit) + Number(line.credit);
    const from = new Date(line.postingDate);
    from.setDate(from.getDate() - 5);
    const to = new Date(line.postingDate);
    to.setDate(to.getDate() + 5);

    // Find unmatched journal lines with close amount and date
    const candidates = await prisma.journalLine.findMany({
      where: {
        accountId: ledgerAccountId,
        entry: { tenantId, status: 'posted', entryDate: { gte: from, lte: to } },
        id: { notIn: (await prisma.bankStatementLine.findMany({ where: { matchedJournalLineId: { not: null } }, select: { matchedJournalLineId: true } })).map(x => x.matchedJournalLineId!) },
      },
      include: { entry: { select: { entryDate: true, narration: true } } },
    });

    let bestScore = 0;
    let bestCandidate: any = null;

    for (const candidate of candidates) {
      const candAmt = Number(candidate.debit) + Number(candidate.credit);
      let score = 0;
      if (Math.abs(candAmt - lineAmt) < 0.01) score += 0.40;
      else continue; // Skip non-amount-matching

      const dayDiff = Math.abs((new Date(candidate.entry.entryDate).getTime() - new Date(line.postingDate).getTime()) / 86400000);
      if (dayDiff === 0) score += 0.20;
      else if (dayDiff <= 1) score += 0.10;

      // Description overlap (simple word match)
      const lineWords = new Set(line.description.toLowerCase().split(/\W+/).filter(Boolean));
      const candWords = new Set((candidate.entry.narration ?? '').toLowerCase().split(/\W+/).filter(Boolean));
      const intersection = [...lineWords].filter(w => candWords.has(w)).length;
      const union = new Set([...lineWords, ...candWords]).size;
      if (union > 0) score += 0.20 * (intersection / union);

      if (score > bestScore) { bestScore = score; bestCandidate = candidate; }
    }

    if (bestCandidate && bestScore >= 0.85) {
      // Auto-match
      await prisma.bankStatementLine.update({
        where: { id: line.id },
        data: { status: 'matched', matchedJournalLineId: bestCandidate.id, matchedAt: new Date() },
      });
    } else if (bestCandidate && bestScore >= 0.60) {
      // Create proposal
      await prisma.bankMatchProposal.upsert({
        where: { statementLineId_journalLineId: { statementLineId: line.id, journalLineId: bestCandidate.id } },
        create: { statementLineId: line.id, journalLineId: bestCandidate.id, score: bestScore, reason: `Score: ${bestScore.toFixed(2)}` },
        update: { score: bestScore },
      });
    }
  }
}

export async function acceptProposal(proposalId: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const proposal = await prisma.bankMatchProposal.findUnique({
    where: { id: proposalId },
    include: { statementLine: true },
  });
  if (!proposal) return { ok: false, error: 'Not found' };

  await prisma.bankStatementLine.update({
    where: { id: proposal.statementLineId },
    data: { status: 'matched', matchedJournalLineId: proposal.journalLineId, matchedAt: new Date(), matchedById: session.user?.id },
  });

  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'match', entityType: 'bank_statement_line', entityId: proposal.statementLineId });
  return { ok: true };
}

export async function rejectProposal(proposalId: string) {
  const session = await auth();
  if (!session) redirect('/login');

  await prisma.bankMatchProposal.delete({ where: { id: proposalId } });
  return { ok: true };
}

export async function ignoreLine(statementLineId: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  await prisma.bankStatementLine.update({ where: { id: statementLineId }, data: { status: 'ignored' } });
  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'ignore', entityType: 'bank_statement_line', entityId: statementLineId });
  return { ok: true };
}

export async function unmatchLine(statementLineId: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  await prisma.bankStatementLine.update({
    where: { id: statementLineId },
    data: { status: 'unmatched', matchedJournalLineId: null, matchedAt: null, matchedById: null },
  });
  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'unmatch', entityType: 'bank_statement_line', entityId: statementLineId });
  return { ok: true };
}

export async function markReconciled(statementId: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const stmt = await prisma.bankStatement.findFirst({
    where: { id: statementId, bankAccount: { tenantId } },
    include: { _count: { select: { lines: { where: { status: 'unmatched' } } } } },
  });
  if (!stmt) return { ok: false, error: 'Statement not found' };
  if ((stmt as any)._count.lines > 0) return { ok: false, error: 'All lines must be matched or ignored.' };

  await prisma.bankStatement.update({ where: { id: statementId }, data: { status: 'reconciled' } });
  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'match', entityType: 'bank_statement', entityId: statementId, after: { status: 'reconciled' } });
  return { ok: true };
}

export async function getLedgerAccounts() {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  return prisma.account.findMany({
    where: { tenantId, isActive: true, subType: { in: ['cash','bank'] } },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });
}
