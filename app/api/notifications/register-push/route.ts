import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';

/**
 * Web FCM token registration for logged-in dashboard users. Mirrors the mobile
 * /api/v1/fcm-token route but authenticates via the NextAuth session instead of
 * the mobile JWT. Upserts into DeviceToken (platform 'web') so the shared push
 * dispatcher (lib/notify/channels/push.ts) targets this user's browser too.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const token = String(body.token || '');
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

    const tenantId = await getDefaultTenantId();
    await prisma.deviceToken.upsert({
      where: { token },
      update: { userId, tenantId, platform: 'web', lastSeenAt: new Date() },
      create: { token, userId, tenantId, platform: 'web' },
    });

    return NextResponse.json({ registered: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Token register failed' }, { status: 500 });
  }
}
