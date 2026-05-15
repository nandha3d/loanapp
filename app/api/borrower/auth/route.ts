import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { getTenantIdFromHost } from '@/lib/tenant';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';

function getBorrowerJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET environment variable is required for the borrower portal.');
  return new TextEncoder().encode(secret);
}

export async function POST(request: Request) {
  try {
    // Rate limit: 10 login attempts per IP per 15 minutes
    const ip = getClientIp(request);
    const rl = await checkRateLimit(routeKey('borrower:login', ip), { limit: 10, windowMs: 15 * 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, { status: 429 });
    }

    // Resolve tenant from request host
    const host = request.headers.get('host');
    const tenantId = await getTenantIdFromHost(host);
    if (!tenantId) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
      }
      // In development, fall back to first active tenant so local testing works
      const fallback = await prisma.tenant.findFirst({ where: { status: 'active' }, select: { id: true } });
      if (!fallback) {
        return NextResponse.json({ error: 'No active tenant found' }, { status: 404 });
      }
    }
    const resolvedTenantId = tenantId ?? (
      await prisma.tenant.findFirst({ where: { status: 'active' }, select: { id: true } })
    )?.id;

    const { loanCode, phone } = await request.json();

    if (!loanCode || !phone) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    const loan = await prisma.loan.findFirst({
      where: {
        loanCode,
        ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
        customer: {
          phone: phone.trim(),
        },
        status: 'active',
      },
      select: {
        id: true,
        tenantId: true,
        customerId: true,
      },
    });

    if (!loan) {
      return NextResponse.json({ error: 'Invalid loan code or phone number' }, { status: 401 });
    }

    const token = await new SignJWT({
      loanId: loan.id,
      tenantId: loan.tenantId,
      customerId: loan.customerId,
      role: 'borrower',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(getBorrowerJwtSecret());

    const cookieStore = await cookies();
    cookieStore.set('borrower_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Borrower auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
