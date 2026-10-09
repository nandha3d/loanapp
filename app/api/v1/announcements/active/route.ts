import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { ok, fail } from '@/lib/api/v1-envelope';
import { getActiveUserAnnouncements } from '@/lib/announcements/announcementService';

export async function GET(req: NextRequest) {
  let userId: string | null = null;

  // 1. Check mobile bearer token if present
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const mobileAuth = await requireMobileContext(req);
    if (!mobileAuth.response) {
      userId = mobileAuth.context.userId;
    }
  }

  // 2. Fall back to NextAuth web session
  if (!userId) {
    const session = await auth();
    userId = session?.user?.id ?? null;
  }

  if (!userId) {
    return fail('Unauthorized', 401);
  }

  try {
    const data = await getActiveUserAnnouncements(userId);
    return ok(data);
  } catch (err: any) {
    console.error('[GET /api/v1/announcements/active] error:', err);
    return fail(err?.message || 'Failed to fetch active announcements', 500);
  }
}
