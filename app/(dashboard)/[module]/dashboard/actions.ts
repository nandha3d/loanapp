'use server';

import { auth } from '@/lib/auth';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import { startOfBusinessToday, startOfBusinessDate } from '@/lib/businessTime';
import { getActivityFeed } from '@/lib/dashboard/activityFeed';

export type ActivityRange = 'yesterday' | 'last7' | 'last30' | 'custom';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Recent Activities for a past window — the web version of the mobile date
 * filter (Yesterday / Last 7 Days / Last 30 Days / Custom). "Today" is rendered
 * from the dashboard's own server data and never comes through here.
 * Windows are resolved in business time (IST) on the server; `from`/`to` are
 * inclusive YYYY-MM-DD business dates for the custom range.
 */
export async function fetchRecentActivities(input: { range: ActivityRange; from?: string; to?: string }) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return { ok: false as const, error: 'unauthorized' };

  const todayStart = startOfBusinessToday();
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  let start: Date;
  let end: Date;

  try {
    switch (input.range) {
      case 'yesterday':
        start = new Date(todayStart.getTime() - DAY_MS);
        end = todayStart;
        break;
      case 'last7':
        start = new Date(todayStart.getTime() - 7 * DAY_MS);
        end = tomorrowStart;
        break;
      case 'last30':
        start = new Date(todayStart.getTime() - 30 * DAY_MS);
        end = tomorrowStart;
        break;
      case 'custom': {
        if (!input.from || !input.to) return { ok: false as const, error: 'invalid_range' };
        start = startOfBusinessDate(input.from);
        end = new Date(startOfBusinessDate(input.to).getTime() + DAY_MS);
        // Same one-year look-back the mobile picker allows.
        if (end <= start || end > tomorrowStart || start.getTime() < todayStart.getTime() - 366 * DAY_MS) {
          return { ok: false as const, error: 'invalid_range' };
        }
        break;
      }
      default:
        return { ok: false as const, error: 'invalid_range' };
    }
  } catch {
    return { ok: false as const, error: 'invalid_range' };
  }

  const [tenantId, appType, branchId] = await Promise.all([
    getDefaultTenantId(),
    getUserAppType(),
    getActiveBranchId(),
  ]);

  const data = await getActivityFeed(
    { tenantId, appType, branchId: branchId ?? null, role: user.role ?? '', userId: user.id },
    start,
    end,
  );
  return { ok: true as const, data };
}
