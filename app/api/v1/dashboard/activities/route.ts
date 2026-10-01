import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getActivityFeed } from '@/lib/dashboard/activityFeed';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const IST_OFFSET_MS = 330 * 60 * 1000;
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const istMidnightUtcMs =
    Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) -
    IST_OFFSET_MS;

  const fromParam = req.nextUrl.searchParams.get('from');
  const toParam = req.nextUrl.searchParams.get('to');

  let startDate: Date;
  let endDate: Date;

  if (fromParam && toParam) {
    startDate = new Date(fromParam);
    endDate = new Date(toParam);
  } else {
    startDate = new Date(istMidnightUtcMs);
    endDate = new Date(istMidnightUtcMs + 24 * 60 * 60 * 1000);
  }

  try {
    const feed = await getActivityFeed(
      {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        branchId: ctx.branchId,
        role: ctx.role,
        userId: ctx.userId,
      },
      startDate,
      endDate,
    );
    return ok(feed);
  } catch (err: any) {
    return fail(err?.message || 'Failed to fetch dashboard activities', 500);
  }
}
