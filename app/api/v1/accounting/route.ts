import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { applyAccountingCashToBranch } from '@/lib/wallet';
import { getAccountingSummary } from '@/lib/accounting/summary';
import { autoPostExpense, autoPostCapitalAdd, autoPostCapitalWithdraw } from '@/lib/accounting/autoPost';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  // ACC-01 (D1): the same summary the web Accounting page renders — loans in
  // every status, the full released-to-agents total, optional ?from&to range.
  const { searchParams } = new URL(req.url);
  const day = (v: string | null) => (v && v.length === 10 && !Number.isNaN(Date.parse(v)) ? v : null);
  const range = { from: day(searchParams.get('from')), to: day(searchParams.get('to')) };

  try {
    const summary = await getAccountingSummary(ctx.tenantId, ctx.appType, ctx.branchId, range);
    const m = summary.metrics;
    return ok({
      // Range KPIs (web Accounting cards).
      totalCollected: m.totalCollected,
      totalDisbursed: m.totalDisbursed,
      totalExpenses: m.totalExpenses,
      currentCapital: m.currentCapital,
      capitalIn: m.capitalIn,
      capitalOut: m.capitalOut,
      releasedToAgents: m.releasedToAgents,
      totalDeductions: m.totalDeductions,
      totalInterest: m.totalInterest,
      penaltyIncome: m.penaltyIncome,
      projectedRevenue: m.projectedRevenue,
      netProfit: m.projectedProfit,
      // Position (not ranged).
      liquidCash: summary.liquidCash,
      loanOutstanding: summary.loanOutstanding,
      netWorth: summary.netWorth,
      branchCashAvailable: summary.branchCashAvailable,
      agentFloat: summary.agentFloat,
      range,
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
          appType: ctx.appType,
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
          appType: ctx.appType,
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
          appType: ctx.appType,
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
      await autoPostExpense({ tenantId: ctx.tenantId, appType: ctx.appType, entryId: entry.id, description: description || 'Expense', amount, date: entryDate, branchId, createdById: ctx.userId, category });
    } else if (type === 'capital_add') {
      await autoPostCapitalAdd({ tenantId: ctx.tenantId, appType: ctx.appType, entryId: entry.id, description: description || 'Capital Addition', amount, date: entryDate, branchId, createdById: ctx.userId, category });
    } else if (type === 'capital_withdraw') {
      await autoPostCapitalWithdraw({ tenantId: ctx.tenantId, appType: ctx.appType, entryId: entry.id, description: description || 'Capital Withdrawal', amount, date: entryDate, branchId, createdById: ctx.userId, category });
    }

    return ok({ id: entry.id, type, amount });
  } catch (e: any) {
    return fail(e?.message ?? 'Entry create failed', 500);
  }
}
