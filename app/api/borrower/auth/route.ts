import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { getTenantIdFromHost } from '@/lib/tenant';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import { BORROWER_OTP_TTL_SECONDS, generateBorrowerOtp, hashBorrowerOtp, verifyBorrowerOtp } from '@/lib/borrowerOtp';

function getBorrowerJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET or AUTH_SECRET environment variable is required for the borrower portal.');
  if (secret.length < 32) throw new Error('NEXTAUTH_SECRET or AUTH_SECRET must be at least 32 characters');
  return new TextEncoder().encode(secret);
}

function getBorrowerOtpSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET or AUTH_SECRET environment variable is required for borrower OTP.');
  if (secret.length < 32) throw new Error('NEXTAUTH_SECRET or AUTH_SECRET must be at least 32 characters');
  return secret;
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

    const { loanCode, phone, otp } = await request.json();

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

    const cookieStore = await cookies();
    if (!otp) {
      const code = generateBorrowerOtp();
      const challenge = await new SignJWT({
        loanId: loan.id,
        tenantId: loan.tenantId,
        customerId: loan.customerId,
        phone: phone.trim(),
        loanCode,
        otpHash: hashBorrowerOtp(code, getBorrowerOtpSecret()),
        role: 'borrower_otp',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${BORROWER_OTP_TTL_SECONDS}s`)
        .sign(getBorrowerJwtSecret());

      cookieStore.set('borrower_otp', challenge, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: BORROWER_OTP_TTL_SECONDS,
      });

      return NextResponse.json({
        success: false,
        otpRequired: true,
        message: 'OTP sent to the registered phone number.',
        ...(process.env.NODE_ENV !== 'production' ? { testOtp: code } : {}),
      });
    }

    const challengeToken = cookieStore.get('borrower_otp')?.value;
    if (!challengeToken) {
      return NextResponse.json({ error: 'OTP expired. Please request a new OTP.' }, { status: 401 });
    }

    const { payload } = await jwtVerify(challengeToken, getBorrowerJwtSecret());
    if (
      payload.role !== 'borrower_otp' ||
      payload.loanId !== loan.id ||
      payload.phone !== phone.trim() ||
      payload.loanCode !== loanCode ||
      typeof payload.otpHash !== 'string' ||
      !verifyBorrowerOtp({ otp: String(otp), expectedHash: payload.otpHash, secret: getBorrowerOtpSecret() })
    ) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 401 });
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

    cookieStore.set('borrower_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
    });
    cookieStore.delete('borrower_otp');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Borrower auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
