import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getActivityFeed } from '@/lib/dashboard/activityFeed';
import { startOfBusinessToday, startOfBusinessTomorrow } from '@/lib/businessTime';

/**
 * GET /api/v1/dashboard/activities?from=ISO&to=ISO
 * Same feed as the web dashboard date filter (DASH-09): one getActivityFeed()
 * with the same queries, caps, item shapes and SCOPE-18 approval visibility.
 * Defaults to today (IST business day).
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const fromParam = req.nextUrl.searchParams.get('from');
  const toParam = req.nextUrl.searchParams.get('to');
  const startDate = fromParam && toParam ? new Date(fromParam) : startOfBusinessToday();
  const endDate = fromParam && toParam ? new Date(toParam) : startOfBusinessTomorrow();
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return fail('Invalid date range', 400);
  }

  try {
    const data = await getActivityFeed(
      { tenantId: ctx.tenantId, appType: ctx.appType, branchId: ctx.branchId, role: ctx.role, userId: ctx.userId },
      startDate,
      endDate,
    );
    return ok(data);
  } catch (err: any) {
    return fail(err?.message || 'Failed to fetch dashboard activities', 500);
  }
}
