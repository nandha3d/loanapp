import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import { isPremiumAccountingEnabled } from '@/lib/accounting/premium';
import PremiumDisabledPlaceholder from '@/components/accounting/PremiumDisabledPlaceholder';
import DashboardClient from './DashboardClient';
import {
  getCashBankBalance,
  getNetProfit,
  getAccountBalance,
  getOpenBillsTotal,
  getDailyCashflowSeries,
  getTopExpenses,
  getPendingApprovalsForUser,
  getBillsDueWithin,
  getPeriodStatus,
  getOperationalSummary,
  getOperationalCashflowSeries,
} from '@/lib/accounting/queries';

export const metadata = { title: 'Premium Accounting · Dashboard' };

export default async function PremiumDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { module } = await params;
  const sp = await searchParams;

  const session = await auth();
  if (!session) redirect('/login');
  const user = session.user as any;
  if (!['admin', 'superadmin', 'developer'].includes(user.role)) {
    redirect(`/${module}/collection`);
  }

  const tenantId = await getDefaultTenantId();
  const enabled = await isPremiumAccountingEnabled(tenantId);
  if (!enabled) return <PremiumDisabledPlaceholder addOnKey="premium_accounting" />;

  const branchId = await getActiveBranchId();

  const today = new Date();

  function resolvePeriod(p?: string): { from: Date; to: Date; label: string } {
    if (p === 'last_month') {
      const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return {
        from: d,
        to: new Date(today.getFullYear(), today.getMonth(), 0),
        label: 'Last Month',
      };
    }
    if (p === 'this_quarter') {
      const q = Math.floor(today.getMonth() / 3);
      const from = new Date(today.getFullYear(), q * 3, 1);
      const to = new Date(today.getFullYear(), q * 3 + 3, 0);
      return { from, to, label: 'This Quarter' };
    }
    if (p === 'this_year') {
      return {
        from: new Date(today.getFullYear(), 0, 1),
        to: new Date(today.getFullYear(), 11, 31),
        label: 'This Year',
      };
    }
    // default: this month
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth() + 1, 0),
      label: 'This Month',
    };
  }

  const period = resolvePeriod(sp.period);
  const prev = {
    from: new Date(period.from.getFullYear(), period.from.getMonth() - 1, 1),
    to: new Date(period.from.getFullYear(), period.from.getMonth(), 0),
  };

  const daysAgo89 = new Date(today);
  daysAgo89.setDate(today.getDate() - 89);

  const [
    cashBankNow,
    cashBankPrev,
    pnlJe,
    pnlPrevJe,
    arJe,
    ap,
    cashflowSeriesJe,
    topExpenses,
    pendingApprovals,
    billsDueSoon,
    periodStatus,
    opNow,
    opPrev,
    opCashflow,
  ] = await Promise.all([
    getCashBankBalance(tenantId, branchId, period.to),
    getCashBankBalance(tenantId, branchId, prev.to),
    getNetProfit(tenantId, branchId, period),
    getNetProfit(tenantId, branchId, prev),
    getAccountBalance(tenantId, branchId, '1310', period.to), // Loans Receivable
    getOpenBillsTotal(tenantId, branchId, period.to),
    getDailyCashflowSeries(tenantId, branchId, daysAgo89, today),
    getTopExpenses(tenantId, branchId, period, 5),
    getPendingApprovalsForUser(user.id, tenantId, branchId, 5),
    getBillsDueWithin(tenantId, branchId, 7),
    getPeriodStatus(tenantId, period.from),
    getOperationalSummary(tenantId, branchId, period),
    getOperationalSummary(tenantId, branchId, prev),
    getOperationalCashflowSeries(tenantId, branchId, daysAgo89, today),
  ]);

  // Prefer JE-based data when available; fall back to operational data
  const hasJeData = cashBankNow !== 0 || pnlJe !== 0 || arJe !== 0;
  const cashBankDisplay = hasJeData ? cashBankNow : opNow.collected - opNow.disbursed;
  const cashBankPrevDisplay = hasJeData ? cashBankPrev : opPrev.collected - opPrev.disbursed;
  const pnl = hasJeData ? pnlJe : opNow.netProfit;
  const pnlPrev = hasJeData ? pnlPrevJe : opPrev.netProfit;
  const ar = hasJeData ? arJe : opNow.outstanding;
  const cashflowSeries = cashflowSeriesJe.some(d => d.inflow > 0 || d.outflow > 0)
    ? cashflowSeriesJe
    : opCashflow;

  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: 'var(--text-secondary)' }}>Loading dashboard…</div>}>
      <DashboardClient
        module={module}
        period={{
          from: period.from.toISOString(),
          to: period.to.toISOString(),
          label: period.label,
        }}
        cashBankNow={cashBankDisplay}
        cashBankPrev={cashBankPrevDisplay}
        pnl={pnl}
        pnlPrev={pnlPrev}
        ar={ar}
        ap={ap}
        cashflowSeries={cashflowSeries}
        topExpenses={topExpenses}
        pendingApprovals={JSON.parse(JSON.stringify(pendingApprovals))}
        billsDueSoon={JSON.parse(JSON.stringify(billsDueSoon))}
        periodStatus={
          periodStatus
            ? {
                status: periodStatus.status,
                lastLockedAt: periodStatus.lastLockedAt?.toISOString() ?? null,
              }
            : null
        }
      />
    </Suspense>
  );
}
