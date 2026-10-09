import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { ok, fail } from '@/lib/api/v1-envelope';
import { markAnnouncementRead } from '@/lib/announcements/announcementService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let userId: string | null = null;

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const mobileAuth = await requireMobileContext(req);
    if (!mobileAuth.response) {
      userId = mobileAuth.context.userId;
    }
  }

  if (!userId) {
    const session = await auth();
    userId = session?.user?.id ?? null;
  }

  if (!userId) {
    return fail('Unauthorized', 401);
  }

  try {
    await markAnnouncementRead(id, userId);
    return ok({ success: true, message: 'Announcement marked as read' });
  } catch (err: any) {
    return fail(err?.message || 'Failed to mark announcement as read', 500);
  }
}
