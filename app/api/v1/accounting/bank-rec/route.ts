import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { writeAuditLog } from '@/lib/accounting/premium';

// Matching engine local copy helper
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
      else continue;

      const dayDiff = Math.abs((new Date(candidate.entry.entryDate).getTime() - new Date(line.postingDate).getTime()) / 86400000);
      if (dayDiff === 0) score += 0.20;
      else if (dayDiff <= 1) score += 0.10;

      const lineWords = new Set(line.description.toLowerCase().split(/\W+/).filter(Boolean));
      const candWords = new Set((candidate.entry.narration ?? '').toLowerCase().split(/\W+/).filter(Boolean));
      const intersection = [...lineWords].filter(w => candWords.has(w)).length;
      const union = new Set([...lineWords, ...candWords]).size;
      if (union > 0) score += 0.20 * (intersection / union);

      if (score > bestScore) { bestScore = score; bestCandidate = candidate; }
    }

    if (bestCandidate && bestScore >= 0.85) {
      await prisma.bankStatementLine.update({
        where: { id: line.id },
        data: { status: 'matched', matchedJournalLineId: bestCandidate.id, matchedAt: new Date() },
      });
    } else if (bestCandidate && bestScore >= 0.60) {
      await prisma.bankMatchProposal.upsert({
        where: { statementLineId_journalLineId: { statementLineId: line.id, journalLineId: bestCandidate.id } },
        create: { statementLineId: line.id, journalLineId: bestCandidate.id, score: bestScore, reason: `Score: ${bestScore.toFixed(2)}` },
        update: { score: bestScore },
      });
    }
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const statementId = searchParams.get('statementId');
    const bankAccountId = searchParams.get('bankAccountId');

    if (statementId) {
      const showUnmatchedOnly = searchParams.get('showUnmatchedOnly') === 'true';
      const stmt = await prisma.bankStatement.findFirst({
        where: { id: statementId, bankAccount: { tenantId: ctx.tenantId } },
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
      return ok({ statement: stmt });
    }

    if (bankAccountId) {
      const detail = await prisma.bankAccount.findFirst({
        where: { id: bankAccountId, tenantId: ctx.tenantId },
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
      return ok({ bankAccount: detail });
    }

    // Default: list bank accounts and ledger accounts (cash/bank)
    const accounts = await prisma.bankAccount.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
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

    const bankAccountsWithBal = await Promise.all(accounts.map(async (ba) => {
      const agg = await prisma.journalLine.aggregate({
        _sum: { debit: true, credit: true },
        where: { accountId: ba.ledgerAccountId, entry: { tenantId: ctx.tenantId, status: 'posted' } },
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

    const ledgerAccounts = await prisma.account.findMany({
      where: { tenantId: ctx.tenantId, isActive: true, subType: { in: ['cash', 'bank'] } },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });

    return ok({ bankAccounts: bankAccountsWithBal, ledgerAccounts });
  } catch (e: any) {
    return fail(e.message, 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'create_account') {
      const { name, bankName, accountNo, ifsc, ledgerAccountId, openingBalance, openingAsOf } = body;
      if (!name || !bankName || !accountNo || !ledgerAccountId) {
        return fail('Missing required fields for bank account creation', 400);
      }

      const ba = await prisma.bankAccount.create({
        data: {
          tenantId: ctx.tenantId,
          name,
          bankName,
          accountNo,
          ifsc: ifsc || null,
          ledgerAccountId,
          openingBalance: Number(openingBalance ?? 0),
          openingAsOf: new Date(openingAsOf || new Date()),
        },
      });

      await writeAuditLog({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'create',
        entityType: 'bank_statement',
        entityId: ba.id,
      });

      return ok({ success: true, bankAccount: ba });
    }

    if (action === 'import_statement') {
      const { bankAccountId, rows, statementFrom, statementTo, openingBalance, closingBalance } = body;
      if (!bankAccountId || !rows || !Array.isArray(rows) || !statementFrom || !statementTo) {
        return fail('Missing required statement data', 400);
      }

      const ba = await prisma.bankAccount.findFirst({
        where: { id: bankAccountId, tenantId: ctx.tenantId },
      });
      if (!ba) return fail('Bank account not found', 404);

      const existing = await prisma.bankStatement.findFirst({
        where: {
          bankAccountId,
          OR: [
            { statementFrom: { lte: new Date(statementTo) }, statementTo: { gte: new Date(statementFrom) } },
          ],
        },
      });
      if (existing) {
        return fail('Overlapping or duplicate statement already imported.', 400);
      }

      const stmt = await prisma.bankStatement.create({
        data: {
          bankAccountId,
          fileName: `statement-${statementFrom}-${statementTo}.csv`,
          fileFormat: 'csv',
          statementFrom: new Date(statementFrom),
          statementTo: new Date(statementTo),
          openingBalance: Number(openingBalance ?? 0),
          closingBalance: Number(closingBalance ?? 0),
          importedById: ctx.userId,
          lines: {
            create: rows.map(r => ({
              postingDate: new Date(r.postingDate),
              description: r.description,
              reference: r.reference || null,
              debit: Number(r.debit ?? 0),
              credit: Number(r.credit ?? 0),
              runningBalance: r.runningBalance !== undefined ? Number(r.runningBalance) : null,
            })),
          },
        },
      });

      await runMatching(stmt.id, ba.ledgerAccountId, ctx.tenantId);

      await writeAuditLog({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'import_statement',
        entityType: 'bank_statement',
        entityId: stmt.id,
      });

      return ok({ success: true, statement: stmt });
    }

    if (action === 'accept_proposal') {
      const { proposalId } = body;
      if (!proposalId) return fail('Missing proposalId', 400);

      const proposal = await prisma.bankMatchProposal.findUnique({
        where: { id: proposalId },
        include: { statementLine: true },
      });
      if (!proposal) return fail('Proposal not found', 404);

      await prisma.bankStatementLine.update({
        where: { id: proposal.statementLineId },
        data: {
          status: 'matched',
          matchedJournalLineId: proposal.journalLineId,
          matchedAt: new Date(),
          matchedById: ctx.userId,
        },
      });

      await writeAuditLog({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'match',
        entityType: 'bank_statement_line',
        entityId: proposal.statementLineId,
      });

      return ok({ success: true });
    }

    if (action === 'reject_proposal') {
      const { proposalId } = body;
      if (!proposalId) return fail('Missing proposalId', 400);

      await prisma.bankMatchProposal.delete({ where: { id: proposalId } });
      return ok({ success: true });
    }

    if (action === 'ignore_line') {
      const { statementLineId } = body;
      if (!statementLineId) return fail('Missing statementLineId', 400);

      await prisma.bankStatementLine.update({
        where: { id: statementLineId },
        data: { status: 'ignored' },
      });

      await writeAuditLog({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'ignore',
        entityType: 'bank_statement_line',
        entityId: statementLineId,
      });

      return ok({ success: true });
    }

    if (action === 'unmatch_line') {
      const { statementLineId } = body;
      if (!statementLineId) return fail('Missing statementLineId', 400);

      await prisma.bankStatementLine.update({
        where: { id: statementLineId },
        data: { status: 'unmatched', matchedJournalLineId: null, matchedAt: null, matchedById: null },
      });

      await writeAuditLog({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'unmatch',
        entityType: 'bank_statement_line',
        entityId: statementLineId,
      });

      return ok({ success: true });
    }

    if (action === 'reconcile_statement') {
      const { statementId } = body;
      if (!statementId) return fail('Missing statementId', 400);

      const stmt = await prisma.bankStatement.findFirst({
        where: { id: statementId, bankAccount: { tenantId: ctx.tenantId } },
        include: { _count: { select: { lines: { where: { status: 'unmatched' } } } } },
      });
      if (!stmt) return fail('Statement not found', 404);
      if (stmt._count.lines > 0) {
        return fail('All lines must be matched or ignored.', 400);
      }

      await prisma.bankStatement.update({
        where: { id: statementId },
        data: { status: 'reconciled' },
      });

      await writeAuditLog({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'match',
        entityType: 'bank_statement',
        entityId: statementId,
        after: { status: 'reconciled' },
      });

      return ok({ success: true });
    }

    return fail('Invalid action', 400);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
