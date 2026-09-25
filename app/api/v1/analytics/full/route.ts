import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getAnalyticsData } from '../../../../(dashboard)/[module]/analytics/actions';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);

  try {
    const data = await getAnalyticsData(
      ctx.tenantId,
      ctx.appType,
      ctx.branchId
    );

    return ok({
      ...data,
      trend7d: data.trend7d.map((day) => ({ ...day, date: day.dateKey })),
      insights: data.smartInsights,
    });
  } catch (e: any) {
    return fail(e.message || 'Failed to fetch full analytics data');
  }
}
