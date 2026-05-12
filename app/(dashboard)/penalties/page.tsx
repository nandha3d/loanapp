import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import PenaltiesClient from './PenaltiesClient';

export default async function PenaltiesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');

  const resolvedParams = await searchParams;
  const q = resolvedParams.q || '';
  const status = resolvedParams.status || '';
  const routeId = resolvedParams.routeId || '';

  // Build where clause
  const where: any = { loan: { tenantId, appType } };
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

  // Aggregate KPIs
  const aggregates = await prisma.penalty.aggregate({
    where: { loan: { tenantId, appType } },
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
