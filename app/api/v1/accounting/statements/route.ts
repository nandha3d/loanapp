import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { assertPremiumAccountingAccess, PremiumAccountingServiceError } from '@/lib/accounting/premiumMobileService';
import {
  getOperationalCashflowSeries,
  getNetProfit,
  getTopExpenses,
  getCashBankBalance,
} from '@/lib/accounting/queries';

/**
 * GET /api/v1/accounting/statements?from=&to=
 * Read-only financial statements for mobile — ALL figures computed server-side
 * via the shared accounting queries (no client math). Requires the premium add-on.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const from = searchParams.get('from')
    ? new Date(searchParams.get('from')!)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : now;
  const branchId = ctx.branchId ?? null;

  try {
    await assertPremiumAccountingAccess(ctx);
    const [cashflow, netProfit, topExpenses, cashBank] = await Promise.all([
      getOperationalCashflowSeries(ctx.tenantId, branchId, from, to, ctx.appType),
      getNetProfit(ctx.tenantId, branchId, { from, to }, ctx.appType),
      getTopExpenses(ctx.tenantId, branchId, { from, to }, 8, ctx.appType),
      getCashBankBalance(ctx.tenantId, branchId, to, ctx.appType),
    ]);

    const totalInflow = cashflow.reduce((s, d) => s + d.inflow, 0);
    const totalOutflow = cashflow.reduce((s, d) => s + d.outflow, 0);

    return ok({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      netProfit,
      cashBankBalance: cashBank,
      totalInflow,
      totalOutflow,
      netCashflow: totalInflow - totalOutflow,
      cashflow,
      topExpenses,
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Statements failed', e instanceof PremiumAccountingServiceError ? e.status : 500);
  }
}
