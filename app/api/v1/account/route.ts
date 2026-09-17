import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import {
  accountProfileErrorStatus,
  getGenericProfile,
  updateGenericProfile,
} from '@/lib/genericProfile';
import { getClientIp } from '@/lib/rateLimit';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Self-service account profile for non-superadmin roles (admin, agent,
 * developer). Superadmin has its own richer /api/v1/profile endpoint —
 * this one is deliberately generic (name/phone only, no subscription data).
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    return ok(await getGenericProfile(ctx.userId, ctx.tenantId));
  } catch (error) {
    return fail(errorMessage(error, 'Could not load profile'), accountProfileErrorStatus(error));
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const body = await req.json().catch(() => ({}));
    return ok(await updateGenericProfile(
      {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        ip: getClientIp(req),
        userAgent: req.headers.get('user-agent'),
      },
      body,
    ));
  } catch (error) {
    return fail(errorMessage(error, 'Could not update profile'), accountProfileErrorStatus(error));
  }
}
