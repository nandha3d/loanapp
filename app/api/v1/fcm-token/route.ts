import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

/**
 * Mobile FCM device token registration. NOTE: no dedicated `DeviceToken`
 * Prisma model yet — tokens are written into `auditLog` as `fcm_register`
 * entries (entityType='device_token', newValue=JSON). A follow-up migration
 * should introduce `DeviceToken { id, userId, tenantId, token, platform,
 * createdAt, lastSeenAt }` and the FCM dispatcher should query it.
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

    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'fcm_register',
        entityType: 'device_token',
        entityId: ctx.userId,
        newValue: JSON.stringify({ token, platform, registeredAt: new Date() }),
      },
    });

    return ok({ registered: true });
  } catch (e: any) {
    return fail(e?.message ?? 'Token register failed', 500);
  }
}
