import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifySupabaseToken } from '@/lib/supabase/server';

// Given a verified Supabase access token, report whether an app (MySQL) account
// already exists for that email. The client uses this to route new Google users
// into registration (prefilled) vs. logging existing users straight in.
export async function POST(req: NextRequest) {
  try {
    const { access_token } = await req.json().catch(() => ({}));
    const identity = await verifySupabaseToken(String(access_token || ''));
    if (!identity) {
      return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: { email: identity.email },
      select: { id: true, status: true, tenant: { select: { status: true } } },
    });

    return NextResponse.json({
      ok: true,
      exists: Boolean(user),
      email: identity.email,
      name: identity.name,
      provider: identity.provider,
      tenantActive: user ? user.tenant?.status === 'active' : null,
    });
  } catch (e) {
    console.error('[SUPABASE_PRECHECK_ERROR]', e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
