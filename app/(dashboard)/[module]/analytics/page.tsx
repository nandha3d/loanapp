import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getBranding, getUserAppType, getSetting } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { getActiveBranchId } from '@/lib/branch';
import { getAnalyticsData } from './actions';
import AnalyticsClient from './AnalyticsClient';
import ReportsClient from '../reports/ReportsClient';
import ReportShell from '@/components/reports/ReportShell';
import GoldReportsPanel from '../reports/GoldReportsPanel';
import Link from '@/components/layout/DashboardLink';
import { serverFetch } from '@/lib/api-client/server';
import { getDictionary } from '@/lib/i18n';
import { modulePath } from '@/types/modules';
import { getReportsForAppType } from '@/lib/reports/catalog';
import type { AppType } from '@/lib/appConfig';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const appType = await getUserAppType();
  if (!role || role === 'agent') redirect(modulePath(appType, '/dashboard'));

  const tenantId = await getDefaultTenantId();
  const branding = await getBranding(tenantId);
  const activeBranchId = await getActiveBranchId();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const dict = await getDictionary(tenantId);

  const data = await getAnalyticsData(tenantId, appType, activeBranchId);
  const serialized = JSON.parse(JSON.stringify(data));

  // --- REPORTS LOGIC ---
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);

  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const resolvedParams = await searchParams;
  const fromStr = resolvedParams.from || getLocalDateString(defaultFrom);
  const toStr = resolvedParams.to || getLocalDateString(now);
  const routeId = resolvedParams.routeId || '';
  const agentId = resolvedParams.agentId || '';

  const dateFrom = new Date(fromStr);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(toStr);
  dateTo.setHours(23, 59, 59, 999);

  const loanBase: any = { tenantId, appType };
  if (activeBranchId) loanBase.branchId = activeBranchId;

  const instalmentFilter: any = {
    loan: { ...loanBase },
    dueDate: { gte: dateFrom, lte: dateTo },
  };
  if (routeId) {
    instalmentFilter.loan.customer = { routeId };
  }
  if (agentId) {
    instalmentFilter.agentId = agentId;
  }

  const instalments = await prisma.instalment.findMany({
    where: instalmentFilter,
    select: { dueAmount: true, receivedAmount: true, status: true },
  });

  const collectionsFilter: any = {
    tenantId,
    submittedAt: { gte: dateFrom, lte: dateTo },
    loan: { ...loanBase },
  };
  if (routeId) collectionsFilter.customer = { routeId };
  if (agentId) collectionsFilter.agentId = agentId;

  const collections = await prisma.collectionEntry.findMany({
    where: collectionsFilter,
    select: { receivedAmount: true },
  });

  const totalExpected = instalments.reduce((s, i) => s + Number(i.dueAmount), 0);
  const totalCollected = collections.reduce((s, c) => s + Number(c.receivedAmount), 0);
  const efficiency = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 1000) / 10 : 0;

  const overdueLoans = await prisma.loan.findMany({
    where: {
      ...loanBase,
      status: { in: ['active', 'overdue'] },
      ...(routeId ? { customer: { routeId } } : {}),
    },
    include: {
      customer: { select: { name: true, routeId: true } },
      instalments: {
        where: { status: { in: ['missed', 'upcoming'] }, dueDate: { lt: now } },
        select: { dueDate: true },
      },
      penalties: {
        where: { status: 'pending' },
        select: { grossPenalty: true, missedDays: true },
      },
    },
  });

  const agingBuckets = { short: { count: 0, penalty: 0, customers: [] as string[] }, medium: { count: 0, penalty: 0, customers: [] as string[] }, long: { count: 0, penalty: 0, customers: [] as string[] } };

  for (const loan of overdueLoans) {
    if (loan.instalments.length === 0) continue;
    const oldestMissed = loan.instalments.reduce((oldest, i) => {
      const d = new Date(i.dueDate);
      return d < oldest ? d : oldest;
    }, new Date());
    const daysMissed = Math.floor((now.getTime() - oldestMissed.getTime()) / 86400000);
    const penaltyTotal = loan.penalties.reduce((s, p) => s + Number(p.grossPenalty), 0);
    const name = loan.customer.name;

    if (daysMissed <= 7) {
      agingBuckets.short.count++;
      agingBuckets.short.penalty += penaltyTotal;
      if (!agingBuckets.short.customers.includes(name)) agingBuckets.short.customers.push(name);
    } else if (daysMissed <= 30) {
      agingBuckets.medium.count++;
      agingBuckets.medium.penalty += penaltyTotal;
      if (!agingBuckets.medium.customers.includes(name)) agingBuckets.medium.customers.push(name);
    } else {
      agingBuckets.long.count++;
      agingBuckets.long.penalty += penaltyTotal;
      if (!agingBuckets.long.customers.includes(name)) agingBuckets.long.customers.push(name);
    }
  }

  const penaltyAgg = await prisma.penalty.aggregate({
    where: {
      loan: { ...loanBase },
      createdAt: { gte: dateFrom, lte: dateTo },
    },
    _sum: { grossPenalty: true, settledAmount: true, waivedAmount: true },
  });
  const penaltyReport = {
    accrued: Number(penaltyAgg._sum.grossPenalty || 0),
    settled: Number(penaltyAgg._sum.settledAmount || 0),
    waived: Number(penaltyAgg._sum.waivedAmount || 0),
  };

  const loanFilter: any = {
    ...loanBase,
    createdAt: { gte: dateFrom, lte: dateTo },
  };
  if (routeId) loanFilter.customer = { routeId };

  const newLoans = await prisma.loan.findMany({
    where: loanFilter,
    select: { principal: true },
  });
  const disbursement = {
    count: newLoans.length,
    totalPrincipal: newLoans.reduce((s, l) => s + Number(l.principal), 0),
  };

  // SCOPE-12: the agent-performance table is branch work. Tenant-wide, a
  // superadmin on one branch saw every branch's agents and their numbers.
  const agents = await prisma.user.findMany({
    where: { tenantId, appType, role: 'agent', status: 'active', ...(activeBranchId ? { branchId: activeBranchId } : {}) },
    select: { id: true, name: true },
  });

  const agentPerformance = await Promise.all(
    agents.map(async (agent) => {
      const agentCustomers = await prisma.customer.count({
        where: { ...loanBase, agentId: agent.id },
      });

      const agentInstalments = await prisma.instalment.findMany({
        where: {
          loan: { ...loanBase, customer: { agentId: agent.id } },
          dueDate: { gte: dateFrom, lte: dateTo },
        },
        select: { dueAmount: true, receivedAmount: true, status: true },
      });

      const expected = agentInstalments.reduce((s, i) => s + Number(i.dueAmount), 0);
      const collected = agentInstalments
        .filter((i) => i.status === 'paid' || i.status === 'partial')
        .reduce((s, i) => s + Number(i.receivedAmount), 0);
      const hitRate = expected > 0 ? Math.round((collected / expected) * 100) : 0;

      const routes = await prisma.route.findMany({
        where: { tenantId, appType, routeAgents: { some: { agentId: agent.id } }, status: 'active', ...(activeBranchId ? { branchId: activeBranchId } : {}) },
        select: { name: true },
      });

      return {
        id: agent.id,
        name: agent.name,
        route: routes.map((r) => r.name).join(', ') || '—',
        customers: agentCustomers,
        expected,
        collected,
        hitRate,
      };
    })
  );

  // SCOPE-12: the route filter offers only the active branch's routes.
  const allRoutes = await prisma.route.findMany({
    where: { tenantId, appType, status: 'active', ...(activeBranchId ? { branchId: activeBranchId } : {}) },
    orderBy: { name: 'asc' },
  });

  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId }
  });

  const reportSlug = resolvedParams.report || '';

  if (reportSlug) {
    const filterConfig: Record<string, string[]> = {
      'loan-register': ['date', 'branch', 'agent', 'loanType', 'status', 'frequency', 'amount'],
      'loan-status-report': ['branch', 'loanType'],
      'loan-type-report': ['branch', 'loanType'],
      'loan-maturity-report': ['branch', 'loanType'],
      'daily-collection': ['date', 'branch', 'agent', 'paymentMode'],
      'collection-efficiency': ['date', 'branch', 'agent'],
      'agent-collection-report': ['date', 'branch', 'agent'],
      'route-collection-report': ['date', 'branch'],
      'todays-emi-report': ['branch', 'agent'],
      'customer-register': ['branch', 'agent'],
      'customer-loan-history': ['customer'],
      'repeat-borrowers': ['branch'],
      'inactive-customers': ['branch'],
      'top-borrowers': ['branch'],
      'agent-performance': ['date', 'branch', 'agent'],
      'agent-attendance': ['date', 'branch', 'agent'],
      'missed-visit-report': ['date', 'branch', 'agent'],
      'commission-report': ['date', 'branch', 'agent'],
      'cash-flow': ['date', 'branch'],
      'disbursement': ['date', 'branch', 'loanType'],
      'interest-income': ['date', 'branch'],
      'penalty-income-report': ['date', 'branch'],
      'outstanding-balance': ['branch', 'loanType'],
      'profit-report': ['date', 'branch'],
      'branch-performance': ['date'],
      'branch-comparison': ['date'],
      'gps-route': ['date', 'branch', 'agent'],
      'travel-distance': ['date', 'branch', 'agent'],
      'customer-visit-history': ['date', 'customer'],
      'missed-gps-checkin': ['date', 'branch'],
      'notification-report': ['date'],
      'audit-activity': ['date', 'branch', 'agent', 'status'],
      'login-history-report': ['date'],
      'payment-by-mode': ['date', 'branch', 'paymentMode'],
      'failed-payments': ['date', 'branch'],
      'refund-report': ['date', 'branch'],
      'duplicate-payments': ['date', 'branch'],
      'cancelled-payments': ['date', 'branch'],
      'npa-classification-report': ['branch'],
      'wallet-float-ledger': ['date', 'branch'],
      'day-book': ['date', 'branch'],
      'cash-book': ['date', 'branch'],
      'ledger-report': ['date', 'branch'],
      'bank-book': ['date', 'branch'],
      'chit-cash-flow': ['date', 'branch', 'groupId'],
      'chit-group-portfolio': ['branch', 'status', 'groupId'],
      'chit-group-ledger': ['branch', 'status', 'groupId'],
      'chit-subscriber-ledger': ['branch', 'status', 'groupId'],
      'chit-auction-register': ['branch', 'status', 'groupId'],
      'auction-bid-history': ['date', 'branch', 'groupId'],
      'chit-subscription-due': ['branch', 'groupId'],
    };

    const titleConfig: Record<string, string> = {
      'loan-register': 'Loan Register',
      'daily-collection': 'Daily Collection Report',
      'outstanding-balance': 'Outstanding Balance Report',
      'aging': 'Aging Analysis',
      'customer-loan-history': 'Customer Loan History',
      'emi-schedule': 'EMI Schedule',
      'agent-performance': 'Agent Performance',
      'collection-efficiency': 'Collection Efficiency',
      'disbursement': 'Disbursement Report',
      'cash-flow': 'Cash Flow Summary',
      'payment-by-mode': 'Payment by Mode',
      'gps-route': 'GPS Route Log',
      'audit-activity': 'Audit Activity Log',
      'npa-classification-report': 'NPA Classification Report',
      'wallet-float-ledger': 'Wallet Float Ledger',
      'missed-gps-checkin': 'Missed GPS Check-in',
    };

    const supportedFilters = filterConfig[reportSlug] || ['date', 'branch', 'agent'];
    const title = titleConfig[reportSlug] || reportSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    return (
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <Link
            href="/analytics"
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
            Back to Reports & Analytics
          </Link>
        </div>
        <ReportShell
          slug={reportSlug}
          title={title}
          supportedFilters={supportedFilters}
          initialFilters={{
            from: fromStr,
            to: toStr,
            branchId: activeBranchId || '',
            agentId,
            routeId,
            customerId: resolvedParams.customerId || '',
            loanType: resolvedParams.loanType || '',
            status: resolvedParams.status || '',
            frequency: resolvedParams.frequency || '',
            paymentMode: resolvedParams.paymentMode || '',
            paymentStatus: resolvedParams.paymentStatus || '',
            loanId: resolvedParams.loanId || '',
          }}
          dict={dict}
          subscription={subscription}
        />
      </div>
    );
  }

  let goldSummary: any = null, goldPending: any = null, goldOrnaments: any = null;
  if (appType === 'goldloan') {
    try {
      const [s, p, o] = await Promise.all([
        serverFetch<any>('/gold/reports?type=summary').catch(() => null),
        serverFetch<any>('/gold/reports?type=pending').catch(() => null),
        serverFetch<any>('/gold/reports?type=ornaments').catch(() => null),
      ]);
      goldSummary = s?.data ?? null;
      goldPending = p?.data ?? null;
      goldOrnaments = o?.data ?? null;
    } catch { /* tolerate pre-migration */ }
  }

  const reportsForApp = getReportsForAppType(appType as AppType, {
    premiumAccountingEnabled: Boolean(subscription?.premiumAccountingEnabled),
  });
  const reportCategories = Array.from(
    reportsForApp.reduce((categories, report) => {
      const reports = categories.get(report.category) ?? [];
      reports.push({ slug: report.slug, name: report.name });
      categories.set(report.category, reports);
      return categories;
    }, new Map<string, { slug: string; name: string }[]>()),
    ([category, reports]) => ({ category, reports }),
  );

  const accountingLinks = subscription?.premiumAccountingEnabled
    ? [
        { href: '/accounting/premium/pnl', name: 'Income Statement (P&L)' },
        { href: '/accounting/premium/trial-balance', name: 'Trial Balance' },
        { href: '/accounting/premium/journal', name: 'Journal Report' },
        { href: '/accounting/premium/tax', name: 'GST Report' },
      ]
    : [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            <span className="material-icons-outlined" style={{ verticalAlign: 'middle', marginRight: '8px', fontSize: '1.4rem' }}>insights</span>
            Reports & Analytics
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
            Portfolio intelligence, risk monitoring, operational insights, and comprehensive reporting suite.
          </p>
        </div>
      </div>
      
      <AnalyticsClient data={serialized} currencySymbol={branding.currencySymbol} dict={dict} />
      
      <div style={{ marginTop: '40px' }}>
        <h3 style={{ marginBottom: '20px', fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <span className="material-icons-outlined" style={{ color: 'var(--primary)' }}>library_books</span>
          All Reports Center
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          {reportCategories.map((cat) => (
            <div className="card" key={cat.category} style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ margin: '0 0 14px', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {cat.category}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {cat.reports.map((rep) => (
                  <Link
                    key={rep.slug}
                    href={`/analytics?report=${rep.slug}`}
                    className="btn btn-secondary btn-sm"
                    style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '8px 12px' }}
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '16px', marginRight: '8px', color: 'var(--primary)' }}>description</span>
                    {rep.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {accountingLinks.length > 0 && (
          <div className="card" style={{ marginBottom: '32px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 14px', fontSize: '1.05rem', fontWeight: 700 }}>📊 Financial Statements</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
              {accountingLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '8px 12px' }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '16px', marginRight: '8px' }}>account_balance</span>
                  {l.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {appType === 'goldloan' && (
          <GoldReportsPanel summary={goldSummary} pending={goldPending} ornaments={goldOrnaments} currencySymbol={currencySymbol} />
        )}
      </div>

      <div style={{ marginTop: '32px', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
        <h3 style={{ marginBottom: '20px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-icons-outlined" style={{ color: 'var(--primary)' }}>assessment</span>
          Custom Date Summaries
        </h3>
        <ReportsClient
          collectionEfficiency={{ expected: totalExpected, collected: totalCollected, efficiency }}
          agingBuckets={agingBuckets}
          penaltyReport={penaltyReport}
          disbursement={disbursement}
          agentPerformance={agentPerformance}
          routes={allRoutes}
          agents={agents}
          currencySymbol={currencySymbol}
          filters={{ from: fromStr, to: toStr, routeId, agentId }}
          dict={dict}
          subscription={subscription}
        />
      </div>
    </div>
  );
}
