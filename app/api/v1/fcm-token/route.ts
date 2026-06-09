import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

/**
 * Mobile FCM device-token registration. Upserts into the `DeviceToken` table so
 * the push dispatcher (`lib/notify/channels/push.ts`) can target this user's
 * devices. Re-registering the same token just refreshes ownership + lastSeenAt.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const body = await req.json();
    const token = String(body.token || '');
    const platform = String(body.platform || 'android');
    if (!token) return fail('token required', 400);

    await prisma.deviceToken.upsert({
      where: { token },
      update: { userId: ctx.userId, tenantId: ctx.tenantId, platform, lastSeenAt: new Date() },
      create: { token, userId: ctx.userId, tenantId: ctx.tenantId, platform },
    });

    return ok({ registered: true });
  } catch (e: any) {
    return fail(e?.message ?? 'Token register failed', 500);
  }
}
