import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildMissedVisitReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, to, branchId, agentId, routeId } = params;

  // Single "as of" day — use `to` (falls back to today) per spec ("Date (single)" filter).
  const asOf = to ? new Date(to) : new Date();
  const dayStart = new Date(asOf);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(asOf);
  dayEnd.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  // Worklist: route stops for routes in scope, optionally filtered to a single route.
  const routeWhere: any = {
    tenantId,
    appType,
    ...branchFilter,
    ...(routeId ? { id: routeId } : {}),
    ...(agentId ? { assignedAgentId: agentId } : {}),
  };

  const routes = await prisma.route.findMany({
    where: routeWhere,
    select: { id: true, name: true, assignedAgentId: true, assignedAgent: { select: { id: true, name: true } } },
  });

  if (routes.length === 0) {
    return emptyPayload();
  }

  const routeIds = routes.map((r) => r.id);
  const routeById = new Map(routes.map((r) => [r.id, r]));

  const stops = await prisma.routeStop.findMany({
    where: { tenantId, routeId: { in: routeIds } },
    select: { customerId: true, routeId: true },
  });

  if (stops.length === 0) {
    return emptyPayload();
  }

  const customerIds = stops.map((s) => s.customerId);

  const stopCustomers = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: {
      id: true,
      name: true,
      phone: true,
      agentId: true,
      agent: { select: { id: true, name: true } },
    },
  });
  const customerById = new Map(stopCustomers.map((c) => [c.id, c]));

  // Due instalments "today" for the worklist customers (amount due).
  const dueInstalments = await prisma.instalment.findMany({
    where: {
      dueDate: { gte: dayStart, lte: dayEnd },
      loan: { customerId: { in: customerIds }, tenantId, appType },
    },
    select: { dueAmount: true, loan: { select: { customerId: true } } },
  });
  const dueAmountByCustomer = new Map<string, number>();
  for (const inst of dueInstalments) {
    const cid = inst.loan.customerId;
    dueAmountByCustomer.set(cid, (dueAmountByCustomer.get(cid) || 0) + Number(inst.dueAmount));
  }

  // Visited = has a CollectionEntry submitted that day (GPS-tagged visit/entry).
  const visitedEntries = await prisma.collectionEntry.findMany({
    where: {
      tenantId,
      customerId: { in: customerIds },
      submittedAt: { gte: dayStart, lte: dayEnd },
    },
    select: { customerId: true },
  });
  const visitedSet = new Set(visitedEntries.map((e) => e.customerId));

  // Last visit (any prior collection entry) per customer, for context column.
  const lastVisits = await prisma.collectionEntry.findMany({
    where: { tenantId, customerId: { in: customerIds }, submittedAt: { lt: dayStart } },
    select: { customerId: true, submittedAt: true },
    orderBy: { submittedAt: 'desc' },
  });
  const lastVisitByCustomer = new Map<string, Date>();
  for (const e of lastVisits) {
    if (!lastVisitByCustomer.has(e.customerId)) lastVisitByCustomer.set(e.customerId, e.submittedAt);
  }

  let totalDueAmount = 0;
  const agentsWithGaps = new Set<string>();
  const seenCustomers = new Set<string>();
  const rows: Record<string, any>[] = [];

  for (const stop of stops) {
    if (visitedSet.has(stop.customerId)) continue;
    if (seenCustomers.has(stop.customerId)) continue; // de-dupe if on multiple routes
    seenCustomers.add(stop.customerId);

    const route = routeById.get(stop.routeId);
    const customer = customerById.get(stop.customerId);
    if (!customer) continue;
    const agentName = customer.agent?.name || route?.assignedAgent?.name || '';
    const agentIdForRow = customer.agentId || route?.assignedAgentId || '';
    if (agentIdForRow) agentsWithGaps.add(agentIdForRow);

    const dueAmount = dueAmountByCustomer.get(stop.customerId) || 0;
    totalDueAmount += dueAmount;

    rows.push({
      agentName,
      customerName: customer.name,
      routeName: route?.name || '',
      dueAmount,
      lastVisit: lastVisitByCustomer.get(stop.customerId) || null,
      phone: customer.phone,
    });
  }

  return {
    title: 'reports.missedVisit.title',
    columns: [
      { key: 'agentName', label: 'reports.col.agentName', align: 'left', type: 'text' },
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'routeName', label: 'reports.col.route', align: 'left', type: 'text' },
      { key: 'dueAmount', label: 'reports.col.dueAmount', align: 'right', type: 'currency', total: true },
      { key: 'lastVisit', label: 'reports.col.lastVisit', align: 'center', type: 'date' },
      { key: 'phone', label: 'reports.col.phone', align: 'left', type: 'text' },
    ],
    rows,
    totals: {
      dueAmount: totalDueAmount,
    },
    kpis: [
      { label: 'missedVisits', value: rows.length },
      { label: 'agentsWithGaps', value: agentsWithGaps.size },
      { label: 'uncoveredDueAmount', value: totalDueAmount },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}

function emptyPayload(): ReportPayload {
  return {
    title: 'reports.missedVisit.title',
    columns: [
      { key: 'agentName', label: 'reports.col.agentName', align: 'left', type: 'text' },
      { key: 'customerName', label: 'reports.col.customerName', align: 'left', type: 'text' },
      { key: 'routeName', label: 'reports.col.route', align: 'left', type: 'text' },
      { key: 'dueAmount', label: 'reports.col.dueAmount', align: 'right', type: 'currency', total: true },
      { key: 'lastVisit', label: 'reports.col.lastVisit', align: 'center', type: 'date' },
      { key: 'phone', label: 'reports.col.phone', align: 'left', type: 'text' },
    ],
    rows: [],
    totals: { dueAmount: 0 },
    kpis: [
      { label: 'missedVisits', value: 0 },
      { label: 'agentsWithGaps', value: 0 },
      { label: 'uncoveredDueAmount', value: 0 },
    ],
    meta: { currencySymbol: '₹' },
  };
}
