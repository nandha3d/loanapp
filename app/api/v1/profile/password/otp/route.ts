import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getClientIp } from '@/lib/rateLimit';
import { profileErrorStatus, sendSuperadminPasswordOtp } from '@/lib/profile';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (ctx.role !== 'superadmin') return fail('Forbidden', 403);

  try {
    return ok(await sendSuperadminPasswordOtp({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent'),
    }));
  } catch (error) {
    return fail(errorMessage(error, 'Could not send OTP'), profileErrorStatus(error));
  }
}
