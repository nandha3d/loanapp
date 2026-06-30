import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getClientIp } from '@/lib/rateLimit';
import {
  getSuperadminProfile,
  profileErrorStatus,
  updateSuperadminProfile,
} from '@/lib/profile';

function isSuperadmin(role: string) {
  return role === 'superadmin';
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!isSuperadmin(ctx.role)) return fail('Forbidden', 403);

  try {
    return ok(await getSuperadminProfile(ctx.userId, ctx.tenantId));
  } catch (error) {
    return fail(errorMessage(error, 'Could not load profile'), profileErrorStatus(error));
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!isSuperadmin(ctx.role)) return fail('Forbidden', 403);

  try {
    const body = await req.json().catch(() => ({}));
    return ok(await updateSuperadminProfile(
      {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        ip: getClientIp(req),
        userAgent: req.headers.get('user-agent'),
      },
      body,
    ));
  } catch (error) {
    return fail(errorMessage(error, 'Could not update profile'), profileErrorStatus(error));
  }
}
