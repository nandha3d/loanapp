import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

// Chit-specific cash-flow: per-day contributions-in / prizes-out / dividends-out,
// scoped optionally to one group. Distinct from the generic `cash-flow` report
// (which is tenant-wide across all money types) — this is the "money flow
// across my chit portfolio" view a 40+-group operator actually asked for.

function dateRange(params: ReportBuilderParams) {
  const from = new Date(params.from);
  from.setHours(0, 0, 0, 0);
  const to = new Date(params.to);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

// Resolve the set of subscriptionIds/auctionIds belonging to one chit group, so
// AccountEntry rows (which reference subscriptionId/auctionId/groupId depending
// on entry type, not a denormalized groupId column) can still be scoped without
// a schema change. Cheap: report queries aren't hot-path, and this runs once
// per report render, not per row.
async function resolveGroupScope(tenantId: string, appType: string, groupId?: string) {
  if (!groupId) return null;
  const [subscriptions, auctions] = await Promise.all([
    prisma.chitSubscription.findMany({
      where: { member: { chitGroupId: groupId, chitGroup: { tenantId, appType } } },
      select: { id: true },
    }),
    prisma.chitAuction.findMany({
      where: { chitGroupId: groupId, chitGroup: { tenantId, appType } },
      select: { id: true },
    }),
  ]);
  return {
    subscriptionIds: subscriptions.map((s) => s.id),
    auctionIds: auctions.map((a) => a.id),
  };
}

export async function buildChitCashFlow(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, appType, branchId, groupId } = params;
  const { from, to } = dateRange(params);
  const scope = await resolveGroupScope(tenantId, appType, groupId);

  const entries = await prisma.accountEntry.findMany({
    where: {
      tenantId,
      appType,
      ...(branchId ? { branchId } : {}),
      entryDate: { gte: from, lte: to },
      type: { in: ['collection', 'chit_payout', 'chit_dividend_payout'] },
      ...(scope
        ? {
            OR: [
              { referenceType: 'chit_subscription', referenceId: { in: scope.subscriptionIds } },
              { referenceType: 'chit_auction', referenceId: { in: scope.auctionIds } },
              { referenceType: 'chit_group', referenceId: groupId },
            ],
          }
        : {}),
    },
    orderBy: { entryDate: 'asc' },
  });

  const byDay = new Map<string, { contributionsIn: number; prizesOut: number; dividendsOut: number }>();
  for (const e of entries) {
    const key = e.entryDate.toISOString().slice(0, 10);
    const bucket = byDay.get(key) ?? { contributionsIn: 0, prizesOut: 0, dividendsOut: 0 };
    const amount = Number(e.amount);
    if (e.type === 'collection') bucket.contributionsIn += amount;
    else if (e.type === 'chit_payout') bucket.prizesOut += amount;
    else if (e.type === 'chit_dividend_payout') bucket.dividendsOut += amount;
    byDay.set(key, bucket);
  }

  let runningBalance = 0;
  let totalCollected = 0;
  let totalPrizes = 0;
  let totalDividends = 0;

  const rows = Array.from(byDay.entries()).map(([bucket, item]) => {
    const net = item.contributionsIn - item.prizesOut - item.dividendsOut;
    runningBalance += net;
    totalCollected += item.contributionsIn;
    totalPrizes += item.prizesOut;
    totalDividends += item.dividendsOut;
    return {
      bucket,
      contributionsIn: item.contributionsIn,
      prizesOut: item.prizesOut,
      dividendsOut: item.dividendsOut,
      net,
      balance: runningBalance,
    };
  });

  const moneyHeld = totalCollected - totalPrizes - totalDividends;

  return {
    title: 'reports.chitCashFlow.title',
    columns: [
      { key: 'bucket', label: 'reports.col.period', align: 'left', type: 'text' },
      { key: 'contributionsIn', label: 'reports.col.contributionsIn', align: 'right', type: 'currency', total: true },
      { key: 'prizesOut', label: 'reports.col.prizesOut', align: 'right', type: 'currency', total: true },
      { key: 'dividendsOut', label: 'reports.col.dividendsOut', align: 'right', type: 'currency', total: true },
      { key: 'net', label: 'reports.col.net', align: 'right', type: 'currency', total: true },
      { key: 'balance', label: 'reports.col.runningBalance', align: 'right', type: 'currency' },
    ],
    rows,
    totals: {
      contributionsIn: totalCollected,
      prizesOut: totalPrizes,
      dividendsOut: totalDividends,
      net: totalCollected - totalPrizes - totalDividends,
    },
    kpis: [
      { label: 'totalCollected', value: totalCollected },
      { label: 'totalPaidOut', value: totalPrizes },
      { label: 'totalDividendsPaid', value: totalDividends },
      { label: 'moneyCurrentlyHeld', value: moneyHeld },
    ],
    meta: { currencySymbol: '₹' },
  };
}
