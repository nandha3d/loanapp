import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getUserAppType, getSetting } from '@/lib/tenant';
import prisma from '@/lib/db';
import AgentDashboardClient from './AgentDashboardClient';
import { getDictionary } from '@/lib/i18n';
import { serverFetch } from '@/lib/api-client/server';
import { startOfBusinessToday, formatBusinessDate } from '@/lib/businessTime';

interface Props {
  params: Promise<{ module: string }>;
}

export default async function AgentDashboardPage({ params }: Props) {
  const { module } = await params;
  const session = await auth();
  const sessionUser = session?.user as { role?: string; name?: string } | undefined;
  const role    = sessionUser?.role;
  const userId  = session?.user?.id;

  if (role !== 'agent' || !userId) redirect(`/${module}/dashboard`);

  const tenantId    = await getDefaultTenantId();
  const dict        = await getDictionary(tenantId);
  const appType     = await getUserAppType();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');

  // DASH-11: every figure comes from GET /api/v1/dashboard — the same payload
  // the mobile agent dashboard renders (API-8). Only the 7-day chart still
  // reads DailyCollection.
  const res = await serverFetch<any>('/dashboard');
  const d = res?.data ?? {};
  const today = startOfBusinessToday();
  const weekAgoDate = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
  // DailyCollection.date is a @db.Date — UTC midnight of the IST business day.
  const weekStartDay = new Date(`${formatBusinessDate(weekAgoDate)}T00:00:00.000Z`);
  const tomorrowDay = new Date(weekStartDay.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Last 7 days bar chart data
  const weekRecords = await prisma.dailyCollection.findMany({
    where: {
      tenantId,
      appType,
      agentId: userId,
      date: { gte: weekStartDay, lt: tomorrowDay },
    },
    orderBy: { date: 'asc' },
  });

  const toISODate = (dt: Date) => dt.toISOString().slice(0, 10);
  const weekData = Array.from({ length: 7 }).map((_, i) => {
    const dDate = new Date(weekStartDay.getTime() + i * 24 * 60 * 60 * 1000);
    const found = weekRecords.find((r) => toISODate(new Date(r.date)) === toISODate(dDate));
    const formattedLabel = `${dDate.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dDate.getUTCMonth()]}`;
    return {
      date:      formattedLabel,
      collected: Number(found?.totalCollected || 0),
      expected:  Number(found?.totalExpected  || 0),
    };
  });

  const total = d.todayBreakdown?.total ?? {};
  const paidItems: any[] = d.todaysActivity?.paidItems ?? [];
  const pendingItems: any[] = d.todaysActivity?.pendingItems ?? [];

  return (
    <AgentDashboardClient
      agentName={sessionUser?.name || 'Agent'}
      todayExpected={Number(total.expected ?? d.todayExpected ?? 0)}
      todayCollected={Number(total.collected ?? d.todayCollected ?? 0)}
      todayPct={Number(d.hitRate ?? 0)}
      weekData={weekData}
      monthCollected={Number(d.monthToDate?.collected ?? 0)}
      monthExpected={Number(d.monthToDate?.expected ?? 0)}
      monthPct={Number(d.monthToDate?.pct ?? 0)}
      activeLoanCount={Number(d.activeLoans ?? 0)}
      overdueCount={Number(d.overdueLoans ?? 0)}
      myCustomerCount={Number(d.totalCustomers ?? 0)}
      pendingTodayCount={new Set(pendingItems.map((i) => i.customer?.id).filter(Boolean)).size}
      recentCollections={paidItems.slice(0, 5).map((c) => ({
        customerName: c.customer?.name ?? '',
        customerCode: c.customer?.customerCode ?? '',
        loanCode:     c.loan?.loanCode ?? '',
        amount:       Number(c.receivedAmount),
        time:         new Date(c.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
        preferredCollectionTime: c.customer?.preferredCollectionTime ?? null,
      }))}
      currencySymbol={currencySymbol}
      modulePrefix={module}
      dict={dict}
    />
  );
}
