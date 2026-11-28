import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyFirebaseIdToken } from '@/lib/firebase/server';

/**
 * Verifies a Firebase Google ID token on the server and checks whether an
 * app user (MySQL) already exists for that email/uid.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const idToken = String(body?.idToken || '');
    const identity = await verifyFirebaseIdToken(idToken);
    if (!identity) {
      return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identity.email }, { googleId: identity.uid }],
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        tenant: { select: { status: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      exists: Boolean(user),
      email: identity.email,
      name: identity.name,
      uid: identity.uid,
      provider: identity.provider,
      tenantActive: user ? user.tenant?.status === 'active' : null,
    });
  } catch (err) {
    console.error('[FIREBASE_PRECHECK_ERROR]', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
