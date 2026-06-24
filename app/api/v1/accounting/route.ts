import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { applyAccountingCashToBranch } from '@/lib/wallet';
import { autoPostExpense, autoPostCapitalAdd, autoPostCapitalWithdraw } from '@/lib/accounting/autoPost';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const loanBase: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    ...scopedBranchWhere(ctx),
  };

  try {
    // All accounting entries for this tenant/branch
    const entries = await prisma.accountEntry.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...scopedBranchWhere(ctx),
      },
      select: { type: true, amount: true },
    });

    let capitalIn = 0;
    let capitalOut = 0;
    let totalDisbursed = 0;
    let totalCollected = 0;
    let totalExpenses = 0;

    for (const e of entries) {
      const amt = Number(e.amount);
      switch (e.type) {
        case 'capital_add':      capitalIn      += amt; break;
        case 'capital_withdraw': capitalOut     += amt; break;
        case 'loan_disburse':    totalDisbursed += amt; break;
        case 'collection':       totalCollected += amt; break;
        case 'expense':          totalExpenses  += amt; break;
      }
    }

    const currentCapital =
      capitalIn - capitalOut - totalDisbursed + totalCollected - totalExpenses;

    // Projected interest from active loans
    const activeLoans = await prisma.loan.findMany({
      where: { ...loanBase, status: { in: ['active', 'overdue'] } },
      select: { principal: true, totalPayable: true, deduction: true },
    });

    const totalInterest = activeLoans.reduce(
      (s, l) => s + (Number(l.totalPayable) - Number(l.principal)),
      0,
    );
    const totalDeductions = activeLoans.reduce(
      (s, l) => s + Number(l.deduction),
      0,
    );
    const projectedRevenue = totalInterest + totalDeductions;
    const netProfit = projectedRevenue - totalExpenses;

    // Real cash + receivable (parity with the web Accounting dashboard).
    // Liquid Cash = branch pool + agent floats; Net Worth = Liquid + outstanding.
    const branchScopeId = ctx.branchId || null;
    const agentIds = branchScopeId
      ? (
          await prisma.user.findMany({
            where: { tenantId: ctx.tenantId, branchId: branchScopeId, role: 'agent' },
            select: { id: true },
          })
        ).map((r) => r.id)
      : null;
    const [branchCashAgg, agentFloatAgg, outstandingAgg] = await Promise.all([
      prisma.branchCashAccount.aggregate({
        where: { tenantId: ctx.tenantId, ...(branchScopeId ? { branchId: branchScopeId } : {}) },
        _sum: { balance: true },
      }),
      prisma.agentAccount.aggregate({
        where: { tenantId: ctx.tenantId, ...(agentIds ? { agentId: { in: agentIds } } : {}) },
        _sum: { balance: true },
      }),
      prisma.instalment.aggregate({
        where: { loan: { ...loanBase, status: { in: ['active', 'overdue'] } } },
        _sum: { dueAmount: true, receivedAmount: true },
      }),
    ]);
    const branchCashAvailable = Number(branchCashAgg._sum.balance ?? 0);
    const agentFloat = Number(agentFloatAgg._sum.balance ?? 0);
    const liquidCash = branchCashAvailable + agentFloat;
    const loanOutstanding = Math.max(
      0,
      Number(outstandingAgg._sum.dueAmount ?? 0) - Number(outstandingAgg._sum.receivedAmount ?? 0),
    );
    const netWorth = liquidCash + loanOutstanding;

    return ok({
      totalCollected,
      totalDisbursed,
      totalExpenses,
      currentCapital,
      liquidCash,
      loanOutstanding,
      netWorth,
      branchCashAvailable,
      agentFloat,
      netProfit,
      projectedRevenue,
      capitalIn,
      capitalOut,
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Accounting summary failed', 500);
  }
}

/**
 * Create a basic accounting entry from mobile (expense / capital add / withdraw),
 * mirroring the web addAccountEntry — including the branch cash-pool sync so a
 * cash expense or capital move reflects in Liquid Cash. Admin/superadmin only.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Unauthorized', 403);
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const type = String(body.type || '');
    const category = String(body.category || 'cash');
    const amount = Number(body.amount);
    const description = body.description ? String(body.description) : null;

    if (!['expense', 'capital_add', 'capital_withdraw'].includes(type)) {
      return fail('type must be expense, capital_add or capital_withdraw', 400);
    }
    if (!(amount > 0)) return fail('A positive amount is required', 400);

    const entryDate = body.entryDate ? new Date(String(body.entryDate)) : new Date();
    const branchId = ctx.branchId || null;
    const syncsBranchCash = category === 'cash' && (type === 'capital_add' || type === 'capital_withdraw');
    const isCashExpense = category === 'cash' && type === 'expense';

    if (syncsBranchCash && !branchId) {
      return fail('No active branch to add or withdraw cash capital against.', 400);
    }

    const entry = await prisma.$transaction(async (tx) => {
      const accountEntry = await tx.accountEntry.create({
        data: {
          tenantId: ctx.tenantId,
          entryDate,
          type,
          category,
          amount,
          description,
          createdBy: ctx.userId,
          branchId,
        },
      });

      if (syncsBranchCash) {
        await applyAccountingCashToBranch(tx, {
          tenantId: ctx.tenantId,
          branchId: branchId!,
          amount,
          entryType: type as 'capital_add' | 'capital_withdraw',
          accountEntryId: accountEntry.id,
          byUserId: ctx.userId,
          note: description,
        });
      } else if (isCashExpense && branchId) {
        await applyAccountingCashToBranch(tx, {
          tenantId: ctx.tenantId,
          branchId,
          amount,
          entryType: 'expense',
          accountEntryId: accountEntry.id,
          byUserId: ctx.userId,
          note: description,
        });
      }

      return accountEntry;
    });

    if (type === 'expense') {
      await autoPostExpense({ tenantId: ctx.tenantId, entryId: entry.id, description: description || 'Expense', amount, date: entryDate, branchId, createdById: ctx.userId, category });
    } else if (type === 'capital_add') {
      await autoPostCapitalAdd({ tenantId: ctx.tenantId, entryId: entry.id, description: description || 'Capital Addition', amount, date: entryDate, branchId, createdById: ctx.userId, category });
    } else if (type === 'capital_withdraw') {
      await autoPostCapitalWithdraw({ tenantId: ctx.tenantId, entryId: entry.id, description: description || 'Capital Withdrawal', amount, date: entryDate, branchId, createdById: ctx.userId, category });
    }

    return ok({ id: entry.id, type, amount });
  } catch (e: any) {
    return fail(e?.message ?? 'Entry create failed', 500);
  }
}
