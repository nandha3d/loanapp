import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyVerifyToken } from '@/lib/auth/emailVerification';

function loginRedirect(req: NextRequest, params: string): NextResponse {
  return NextResponse.redirect(new URL(`/login?${params}`, req.url));
}

// GET /api/auth/verify-email?token=... — clicked from the verification email.
// Flips a pending account to active, then bounces to the login page.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const result = verifyVerifyToken(token);
  if (!result.ok) {
    return loginRedirect(req, `verifyError=${encodeURIComponent(result.error)}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: { id: true, status: true },
  });
  if (!user) {
    return loginRedirect(req, 'verifyError=Account%20not%20found');
  }

  // Already-active accounts: treat the click as a no-op success (idempotent).
  if (user.status === 'pending') {
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'active' },
    });
  } else if (user.status !== 'active') {
    return loginRedirect(req, 'verifyError=Account%20is%20not%20eligible');
  }

  return loginRedirect(req, 'verified=1');
}
