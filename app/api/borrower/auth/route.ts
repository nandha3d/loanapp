import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { getTenantIdFromHost } from '@/lib/tenant';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import { BORROWER_OTP_TTL_SECONDS, generateBorrowerOtp, hashBorrowerOtp, verifyBorrowerOtp } from '@/lib/borrowerOtp';
import bcryptjs from 'bcryptjs';

function getBorrowerJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET or AUTH_SECRET environment variable is required for the borrower portal.');
  return new TextEncoder().encode(secret);
}

function getBorrowerOtpSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET or AUTH_SECRET environment variable is required for borrower OTP.');
  return secret;
}

export async function POST(request: Request) {
  try {
    // Rate limit: 15 login attempts per IP per 15 minutes (relaxed to 1000 in dev)
    const isDev = (process.env.NODE_ENV as string) !== 'production';
    const ip = getClientIp(request);
    const rl = await checkRateLimit(routeKey('borrower:login', ip), { 
      limit: isDev ? 1000 : 15, 
      windowMs: 15 * 60 * 1000 
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, { status: 429 });
    }

    // Resolve tenant from request host
    const host = request.headers.get('host');
    const tenantId = await getTenantIdFromHost(host);
    
    // In development, fall back to first active tenant so local testing works
    const resolvedTenantId = tenantId ?? (
      await prisma.tenant.findFirst({ where: { status: 'active' }, select: { id: true } })
    )?.id;

    const { phone, password, otp, newPassword, requestOtp, bypass } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 });
    }

    // Look up customer by phone
    const customer = await prisma.customer.findFirst({
      where: {
        phone: phone.trim(),
        status: 'active',
        ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        phone: true,
        passwordHash: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'No active customer account found with this phone number.' }, { status: 404 });
    }

    const cookieStore = await cookies();

    // Development auto-login bypass
    if ((process.env.NODE_ENV as string) !== 'production' && bypass === true) {
      // Find first active loan
      const firstLoan = await prisma.loan.findFirst({
        where: {
          customerId: customer.id,
          status: 'active',
        },
        select: { id: true },
      }) || await prisma.loan.findFirst({
        where: { customerId: customer.id },
        select: { id: true },
      });

      // Issue Borrower Session
      const token = await new SignJWT({
        loanId: firstLoan?.id || '',
        tenantId: customer.tenantId,
        customerId: customer.id,
        role: 'borrower',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(getBorrowerJwtSecret());

      cookieStore.set('borrower_session', token, {
        httpOnly: true,
        secure: (process.env.NODE_ENV as string) === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
      });

      cookieStore.delete('borrower_otp');

      return NextResponse.json({ success: true });
    }

    // 1. Identifier Check (Step 1 of Wizard)
    if (password === undefined && otp === undefined && newPassword === undefined && !requestOtp) {
      return NextResponse.json({
        success: true,
        passwordExists: !!customer.passwordHash,
      });
    }

    // 2. Request OTP (First-Time Setup or Forgot Password initiation)
    if (requestOtp) {
      const code = generateBorrowerOtp();
      const challenge = await new SignJWT({
        tenantId: customer.tenantId,
        customerId: customer.id,
        phone: customer.phone,
        otpHash: hashBorrowerOtp(code, getBorrowerOtpSecret()),
        role: 'borrower_otp',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${BORROWER_OTP_TTL_SECONDS}s`)
        .sign(getBorrowerJwtSecret());

      cookieStore.set('borrower_otp', challenge, {
        httpOnly: true,
        secure: (process.env.NODE_ENV as string) === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: BORROWER_OTP_TTL_SECONDS,
      });

      return NextResponse.json({
        success: true,
        otpRequired: true,
        message: 'OTP verification code sent.',
        ...((process.env.NODE_ENV as string) !== 'production' ? { testOtp: code } : {}),
      });
    }

    // 3. Complete OTP Password Setup/Reset (Step 2 Alternate)
    if (otp !== undefined && newPassword !== undefined) {
      const challengeToken = cookieStore.get('borrower_otp')?.value;
      if (!challengeToken) {
        return NextResponse.json({ error: 'OTP challenge session expired. Please request a new OTP.' }, { status: 400 });
      }

      let payload: any;
      try {
        const verified = await jwtVerify(challengeToken, getBorrowerJwtSecret());
        payload = verified.payload;
      } catch {
        return NextResponse.json({ error: 'OTP session expired or invalid. Please request a new OTP.' }, { status: 400 });
      }

      if (
        payload.role !== 'borrower_otp' ||
        payload.customerId !== customer.id ||
        payload.phone !== customer.phone ||
        !verifyBorrowerOtp({ otp: String(otp), expectedHash: payload.otpHash, secret: getBorrowerOtpSecret() })
      ) {
        return NextResponse.json({ error: 'Invalid or incorrect OTP code.' }, { status: 401 });
      }

      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
      }

      // Hash password using bcryptjs
      const saltRounds = 10;
      const hashed = await bcryptjs.hash(newPassword, saltRounds);

      // Save hashed password
      await prisma.customer.update({
        where: { id: customer.id },
        data: { passwordHash: hashed },
      });

      // Find first active loan
      const firstLoan = await prisma.loan.findFirst({
        where: {
          customerId: customer.id,
          status: 'active',
        },
        select: { id: true },
      }) || await prisma.loan.findFirst({
        where: { customerId: customer.id },
        select: { id: true },
      });

      // Issue Borrower Session
      const token = await new SignJWT({
        loanId: firstLoan?.id || '',
        tenantId: customer.tenantId,
        customerId: customer.id,
        role: 'borrower',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(getBorrowerJwtSecret());

      cookieStore.set('borrower_session', token, {
        httpOnly: true,
        secure: (process.env.NODE_ENV as string) === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
      });

      cookieStore.delete('borrower_otp');

      return NextResponse.json({ success: true });
    }

    // 4. Standard Password Auth (Step 2 Normal)
    if (password !== undefined) {
      if (!customer.passwordHash) {
        return NextResponse.json({ error: 'Password setup is required for first-time login.' }, { status: 400 });
      }

      const match = await bcryptjs.compare(password, customer.passwordHash);
      if (!match) {
        return NextResponse.json({ error: 'Incorrect password. Please try again.' }, { status: 401 });
      }

      // Find first active loan
      const firstLoan = await prisma.loan.findFirst({
        where: {
          customerId: customer.id,
          status: 'active',
        },
        select: { id: true },
      }) || await prisma.loan.findFirst({
        where: { customerId: customer.id },
        select: { id: true },
      });

      // Issue Borrower Session
      const token = await new SignJWT({
        loanId: firstLoan?.id || '',
        tenantId: customer.tenantId,
        customerId: customer.id,
        role: 'borrower',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(getBorrowerJwtSecret());

      cookieStore.set('borrower_session', token, {
        httpOnly: true,
        secure: (process.env.NODE_ENV as string) === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
      });

      cookieStore.delete('borrower_otp');

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid authentication request parameter state.' }, { status: 400 });
  } catch (error) {
    console.error('Borrower auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
