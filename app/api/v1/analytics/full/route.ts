import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getAnalyticsData } from '../../../../(dashboard)/[module]/analytics/actions';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const data = await getAnalyticsData(
      ctx.tenantId,
      ctx.appType,
      ctx.branchId
    );

    // Map TrendDay to CollectionPoint expected by mobile analytics model
    const trend7d = (data.trend7d || []).map((t) => ({
      date: t.dateKey,
      expected: t.expected,
      collected: t.collected,
    }));

    // Return the response in the standard envelope structure
    return ok({
      collectionEfficiency: data.collectionEfficiency,
      capitalBalance: data.capitalBalance,
      portfolio: data.portfolio,
      trend7d,
      agingBuckets: data.agingBuckets,
      riskScore: data.riskScore,
      agentLeaderboard: (data.agentLeaderboard || []).map((a) => ({
        id: a.id,
        name: a.name,
        expected: a.collected / (a.efficiency > 0 ? a.efficiency / 100 : 1), // back-compute expected if needed
        collected: a.collected,
        hitRate: Math.round(a.efficiency),
      })),
      borrowerSegments: data.borrowerSegments,
      cashflowForecast7d: data.cashflowForecast7d,
      insights: data.smartInsights || [],
      prevWeekCollected: data.prevWeekCollected,
      currentWeekCollected: data.currentWeekCollected,
    });
  } catch (e: any) {
    return fail(e.message || 'Failed to fetch full analytics data');
  }
}
