import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { ensurePendingPenaltiesForMissedLoans } from '@/lib/penalties';
import PenaltiesClient from './PenaltiesClient';

export default async function PenaltiesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const branchId = (session?.user as any)?.branchId as string | undefined;
  if (userRole === 'agent') redirect('/collection');

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');

  const resolvedParams = await searchParams;
  const q = resolvedParams.q || '';
  const status = resolvedParams.status || '';
  const routeId = resolvedParams.routeId || '';

  // Build where clause — scope to branch for admin role
  const loanBase: any = { tenantId, appType };
  if (userRole === 'admin' && branchId) loanBase.branchId = branchId;

  await ensurePendingPenaltiesForMissedLoans({
    tenantId,
    appType,
    branchId: userRole === 'admin' ? branchId : undefined,
    routeId: routeId || undefined,
  });

  const where: any = { loan: loanBase };
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { loan: { loanCode: { contains: q } } },
      { customer: { name: { contains: q } } },
      { customer: { customerCode: { contains: q } } },
    ];
  }
  if (routeId) {
    where.customer = { ...where.customer, routeId };
  }

  // Fetch penalties with related data
  const penalties = await prisma.penalty.findMany({
    where,
    include: {
      loan: { select: { id: true, loanCode: true, tenantId: true } },
      customer: {
        select: { id: true, name: true, customerCode: true, routeId: true, route: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Aggregate KPIs (same branch scope)
  const aggregates = await prisma.penalty.aggregate({
    where: { loan: loanBase },
    _sum: { grossPenalty: true, settledAmount: true, waivedAmount: true },
    _count: true,
  });

  // Routes for filter
  const routes = await prisma.route.findMany({
    where: { tenantId, appType, status: 'active' },
    orderBy: { name: 'asc' },
  });

  const kpis = {
    totalGross: Number(aggregates._sum.grossPenalty || 0),
    totalSettled: Number(aggregates._sum.settledAmount || 0),
    totalWaived: Number(aggregates._sum.waivedAmount || 0),
    count: aggregates._count,
  };

  const serialized = JSON.parse(JSON.stringify(penalties));

  return (
    <PenaltiesClient
      penalties={serialized}
      kpis={kpis}
      routes={routes}
      currencySymbol={currencySymbol}
      filters={{ q, status, routeId }}
    />
  );
}
