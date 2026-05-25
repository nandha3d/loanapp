import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getUserAppType, getSetting, getBranding } from '@/lib/tenant';
import prisma from '@/lib/db';
import AgentDashboardClient from './AgentDashboardClient';
import { getDictionary } from '@/lib/i18n';

interface Props {
  params: Promise<{ module: string }>;
}

export default async function AgentDashboardPage({ params }: Props) {
  const { module } = await params;
  const session = await auth();
  const role    = (session?.user as any)?.role;
  const userId  = session?.user?.id;

  if (role !== 'agent' || !userId) redirect(`/${module}/dashboard`);

  const tenantId    = await getDefaultTenantId();
  const dict        = await getDictionary(tenantId);
  const appType     = await getUserAppType();
  const branding    = await getBranding(tenantId);
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const today = todayDate.toISOString().slice(0, 10);
  
  const weekAgoDate = new Date();
  weekAgoDate.setDate(weekAgoDate.getDate() - 6);
  weekAgoDate.setHours(0, 0, 0, 0);
  const weekAgo = weekAgoDate.toISOString().slice(0, 10);
  
  const monthStartDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  monthStartDate.setHours(0, 0, 0, 0);
  const monthStart = monthStartDate.toISOString().slice(0, 10);

  // Today's collection record
  const todayRecord = await prisma.dailyCollection.findFirst({
    where: { tenantId, appType, agentId: userId, date: todayDate },
  });

  // Last 7 days bar chart data
  const weekRecords = await prisma.dailyCollection.findMany({
    where: {
      tenantId, appType, agentId: userId,
      date: { gte: weekAgoDate, lte: todayDate },
    },
    orderBy: { date: 'asc' },
  });

  // Fill in missing days (days with no collections show as zero)
  const weekData = Array.from({ length: 7 }).map((_, i) => {
    const dDate = new Date(weekAgoDate);
    dDate.setDate(dDate.getDate() + i);
    const d = dDate.toISOString().slice(0, 10);
    const found = weekRecords.find(r => r.date.toISOString().slice(0, 10) === d);
    const formattedLabel = `${dDate.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dDate.getMonth()]}`;
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
  const recentCollections = await prisma.collectionEntry.findMany({
    where: { agentId: userId },
    orderBy: { submittedAt: 'desc' },
    take: 5,
    include: {
      customer: { select: { name: true, customerCode: true } },
      loan:     { select: { loanCode: true } },
    },
  });

  return (
    <AgentDashboardClient
      agentName={(session?.user as any)?.name || 'Agent'}
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
      }))}
      currencySymbol={currencySymbol}
      modulePrefix={module}
      dict={dict}
    />
  );
}
