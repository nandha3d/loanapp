import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { hash } from 'bcryptjs';

// Updates the signed-in user's password in MySQL (the password store of record).
// Used by /reset-password after a Supabase magic-link has proven email ownership
// and established the session.
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { newPassword } = await req.json().catch(() => ({}));
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  try {
    const passwordHash = await hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await prisma.auditLog.create({
      data: {
        tenantId: (session!.user as any).tenantId,
        userId,
        action: 'update',
        entityType: 'auth',
        entityId: userId,
        newValue: JSON.stringify({ event: 'password_reset' }),
      },
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[CHANGE_PASSWORD_ERROR]', e);
    return NextResponse.json({ error: 'Could not update password' }, { status: 500 });
  }
}
