import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { accountProfileErrorStatus, changeGenericPasswordWithOtp } from '@/lib/genericProfile';
import { getClientIp } from '@/lib/rateLimit';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const body = await req.json().catch(() => ({}));
    return ok(await changeGenericPasswordWithOtp(
      {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        ip: getClientIp(req),
        userAgent: req.headers.get('user-agent'),
      },
      body,
    ));
  } catch (error) {
    return fail(errorMessage(error, 'Could not change password'), accountProfileErrorStatus(error));
  }
}
