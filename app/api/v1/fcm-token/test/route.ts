import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { isPushConfigured, sendPushToUsers } from '@/lib/notify/channels/push';

/**
 * Dispatches an immediate test push notification to the caller's registered devices.
 * Allows client and server to verify end-to-end FCM delivery and provides clear
 * diagnostic details if credentials or tokens are missing.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const configured = isPushConfigured();
    const tokenCount = await prisma.deviceToken.count({
      where: { userId: ctx.userId },
    });

    if (!configured) {
      return ok({
        sent: false,
        configured: false,
        deviceCount: tokenCount,
        message: 'Server missing FIREBASE_SERVICE_ACCOUNT. Add Firebase credentials to server environment to enable push.',
      });
    }

    if (tokenCount === 0) {
      return ok({
        sent: false,
        configured: true,
        deviceCount: 0,
        message: 'No device token registered in database. Tap "Re-sync Device Token" in app settings first.',
      });
    }

    await sendPushToUsers([ctx.userId], {
      title: '🔔 Test Notification',
      body: 'Push notifications are working properly on your device!',
      data: {
        type: 'test_notification',
        timestamp: new Date().toISOString(),
      },
    });

    return ok({
      sent: true,
      configured: true,
      deviceCount: tokenCount,
      message: 'Test notification sent to your device via Firebase Cloud Messaging!',
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Test push failed', 500);
  }
}
