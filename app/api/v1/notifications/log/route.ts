import { NextRequest } from 'next/server';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { fail, ok, parseCursorPaging } from '@/lib/api/v1-envelope';
import { listNotificationLogs } from '@/lib/notify/logs';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  if (!['admin', 'superadmin', 'developer'].includes(auth.context.role)) return fail('Forbidden', 403);
  const params = req.nextUrl.searchParams;
  const { cursor, limit } = parseCursorPaging(req.url, { defaultLimit: 50, maxLimit: 100 });
  try {
    const result = await listNotificationLogs(auth.context.tenantId, {
      channel: params.get('channel') || undefined,
      status: params.get('status') || undefined,
      from: params.get('from') || undefined,
      to: params.get('to') || undefined,
      search: params.get('search') || undefined,
      cursor: cursor || undefined,
      limit,
    });
    return ok(result.data, { nextCursor: result.nextCursor, limit });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load delivery log';
    return fail(message, message.startsWith('Invalid') ? 400 : 500);
  }
}
