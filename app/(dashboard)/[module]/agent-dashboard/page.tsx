import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getUserAppType, getSetting } from '@/lib/tenant';
import prisma from '@/lib/db';
import AgentDashboardClient from './AgentDashboardClient';
import { getDictionary } from '@/lib/i18n';

interface Props {
  params: Promise<{ module: string }>;
}

type RecentCollectionWithCustomer = {
  receivedAmount: unknown;
  submittedAt: Date;
  customer: {
    name: string;
    customerCode: string;
    preferredCollectionTime?: string | null;
  };
  loan?: { loanCode?: string | null } | null;
};

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

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayDate = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
  const tomorrowDate = new Date(todayDate.getTime() + 24 * 60 * 60 * 1000);
  const weekAgoDate = new Date(todayDate.getTime() - 6 * 24 * 60 * 60 * 1000);
  const monthStartDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

  // Today's collection record (range match prevents 1-day/timezone drift)
  const todayRecord = await prisma.dailyCollection.findFirst({
    where: {
      tenantId,
      appType,
      agentId: userId,
      date: { gte: todayDate, lt: tomorrowDate },
    },
  });

  // Last 7 days bar chart data
  const weekRecords = await prisma.dailyCollection.findMany({
    where: {
      tenantId,
      appType,
      agentId: userId,
      date: { gte: weekAgoDate, lt: tomorrowDate },
    },
    orderBy: { date: 'asc' },
  });

  const toISODate = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Fill in missing days (days with no collections show as zero)
  const weekData = Array.from({ length: 7 }).map((_, i) => {
    const dDate = new Date(weekAgoDate.getTime() + i * 24 * 60 * 60 * 1000);
    const targetISO = toISODate(dDate);
    const found = weekRecords.find(r => {
      const rDate = new Date(r.date);
      return toISODate(rDate) === targetISO || (
        rDate.getFullYear() === dDate.getUTCFullYear() &&
        rDate.getMonth() === dDate.getUTCMonth() &&
        rDate.getDate() === dDate.getUTCDate()
      );
    });
    const formattedLabel = `${dDate.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dDate.getUTCMonth()]}`;
    return {
      date:      formattedLabel,
      collected: Number(found?.totalCollected || 0),
      expected:  Number(found?.totalExpected  || 0),
    };
  });

  // Month-to-date aggregates
  const monthAgg = await prisma.dailyCollection.aggregate({
    where: { tenantId, appType, agentId: userId, date: { gte: monthStartDate } },
    _sum: { totalCollected: true, totalExpected: true },
  });

  // My active loans count (customers on my routes)
  const myRouteIds = await prisma.route.findMany({
    where: { tenantId, appType, assignedAgentId: userId, status: 'active' },
    select: { id: true },
  }).then(r => r.map(x => x.id));

  const [activeLoanCount, overdueCount, myCustomerCount, pendingTodayCount] = await Promise.all([
    prisma.loan.count({ where: { tenantId, appType, status: 'active', customer: { routeId: { in: myRouteIds } } } }),
    prisma.loan.count({ where: { tenantId, appType, status: 'overdue', customer: { routeId: { in: myRouteIds } } } }),
    prisma.customer.count({ where: { tenantId, appType, routeId: { in: myRouteIds }, status: 'active' } }),
    prisma.instalment.count({
      where: {
        status: 'upcoming',
        dueDate: todayDate,
        loan: { tenantId, appType, customer: { routeId: { in: myRouteIds } } },
      },
    }),
  ]);

  // Last 5 collections I submitted
  const collectionEntryDelegate = prisma.collectionEntry as unknown as {
    findMany(args: unknown): Promise<RecentCollectionWithCustomer[]>;
  };
  const recentCollections = await collectionEntryDelegate.findMany({
    where: { agentId: userId },
    orderBy: { submittedAt: 'desc' },
    take: 5,
    include: {
      customer: { select: { name: true, customerCode: true, preferredCollectionTime: true } },
      loan:     { select: { loanCode: true } },
    },
  });

  return (
    <AgentDashboardClient
      agentName={sessionUser?.name || 'Agent'}
      todayExpected={Number(todayRecord?.totalExpected || 0)}
      todayCollected={Number(todayRecord?.totalCollected || 0)}
      weekData={weekData}
      monthCollected={Number(monthAgg._sum.totalCollected || 0)}
      monthExpected={Number(monthAgg._sum.totalExpected || 0)}
      activeLoanCount={activeLoanCount}
      overdueCount={overdueCount}
      myCustomerCount={myCustomerCount}
      pendingTodayCount={pendingTodayCount}
      recentCollections={recentCollections.map(c => ({
        customerName: c.customer.name,
        customerCode: c.customer.customerCode,
        loanCode:     c.loan?.loanCode ?? '',
        amount:       Number(c.receivedAmount),
        time:         c.submittedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        preferredCollectionTime: c.customer.preferredCollectionTime,
      }))}
      currencySymbol={currencySymbol}
      modulePrefix={module}
      dict={dict}
    />
  );
}
