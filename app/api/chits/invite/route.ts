import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import prisma from '@/lib/db';
import { getBorrowerSession } from '@/lib/borrowerAuth';
import { BORROWER_OTP_TTL_SECONDS, generateBorrowerOtp, hashBorrowerOtp, verifyBorrowerOtp } from '@/lib/borrowerOtp';
import { CHIT_ENGINE_CATALOG, resolveEngineTypeFromGroup } from '@/lib/chits/engineTypes';
import { verifyChitInviteToken } from '@/lib/chits/inviteToken';
import { normalizeWhatsAppPhone } from '@/lib/chits/whatsappImport';
import { sendWhatsAppAuthOtp, isSamuraiExcludedDomain } from '@/lib/whatsappAuth';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import { nextPeriodDate, parseFrequency } from '@/lib/chits/frequency';
import { roundMoney } from '@/lib/chits/calculations';

function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('NEXTAUTH_SECRET or AUTH_SECRET (32+ chars) is required');
  }
  return new TextEncoder().encode(secret);
}

function getOtpSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('NEXTAUTH_SECRET or AUTH_SECRET (32+ chars) is required');
  }
  return secret;
}

async function resolveInviteGroup(code: string, inviteToken: string) {
  const payload = verifyChitInviteToken(inviteToken, code);
  if (!payload) return null;

  const group = await prisma.chitGroup.findFirst({
    where: {
      id: payload.groupId,
      tenantId: payload.tenantId,
      appType: 'chitfunds',
      deletedAt: null,
      status: { in: ['draft', 'active'] },
    },
    include: {
      tenant: { select: { name: true } },
      _count: { select: { members: true } },
      auctions: {
        where: { status: { in: ['pending', 'notice_sent', 'in_progress'] } },
        orderBy: { periodNumber: 'asc' },
        take: 1,
        select: { periodNumber: true, scheduledAt: true, auctionDate: true },
      },
    },
  });
  if (!group) return null;
  return { payload, group };
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') || '';
  const invite = req.nextUrl.searchParams.get('invite') || '';
  const resolved = await resolveInviteGroup(code, invite);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid or expired invite link.' }, { status: 404 });
  }
  const { group } = resolved;
  const engineType = resolveEngineTypeFromGroup(group);
  const existingSession = await getBorrowerSession();
  const alreadySignedInForTenant = existingSession?.tenantId === group.tenantId;

  return NextResponse.json({
    ok: true,
    group: {
      id: group.id,
      groupCode: group.groupCode,
      name: group.name,
      tenantName: group.tenant.name,
      chitValue: Number(group.chitValue),
      monthlyContrib: Number(group.monthlyContrib),
      totalMembers: group.totalMembers,
      enrolledCount: group._count.members,
      availableSlots: Math.max(0, group.totalMembers - group._count.members),
      frequency: group.auctionFrequency,
      engineLabel: CHIT_ENGINE_CATALOG[engineType].name,
      nextAuction: group.auctions[0]
        ? {
            periodNumber: group.auctions[0].periodNumber,
            date: (group.auctions[0].scheduledAt ?? group.auctions[0].auctionDate).toISOString(),
          }
        : null,
    },
    alreadySignedInForTenant,
  });
}

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(routeKey('chit:invite-join', getClientIp(req)), {
    limit: 25,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests — please wait a few minutes.' }, { status: 429 });
  }

  try {
    const body = (await req.json().catch(() => null)) as Record<string, any> | null;
    const code = String(body?.groupCode || '');
    const invite = String(body?.invite || '');
    const action = String(body?.action || 'request_otp');

    const resolved = await resolveInviteGroup(code, invite);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid or expired chit invite link.' }, { status: 404 });
    }
    const { group } = resolved;

    const cookieStore = await cookies();
    const existingSession = await getBorrowerSession();

    if (action === 'session_join') {
      if (!existingSession || existingSession.tenantId !== group.tenantId) {
        return NextResponse.json({ error: 'Verify your mobile number via OTP first.' }, { status: 401 });
      }
      const customer = await prisma.customer.findFirst({
        where: { id: existingSession.customerId, tenantId: group.tenantId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!customer) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

      await enrollCustomerIntoGroup(group, customer.id, customer.name);
      return NextResponse.json({ ok: true, redirectUrl: `/borrower/chits/${group.id}/room` });
    }

    const name = String(body?.name || '').trim().slice(0, 120);
    const cleanPhone = normalizeWhatsAppPhone(String(body?.phone || ''));
    if (!cleanPhone) {
      return NextResponse.json({ error: 'Enter a valid 10-digit WhatsApp mobile number.' }, { status: 400 });
    }

    if (action === 'request_otp') {
      if (!name) return NextResponse.json({ error: 'Your full name is required.' }, { status: 400 });
      const otpCode = generateBorrowerOtp();
      const challenge = await new SignJWT({
        tenantId: group.tenantId,
        groupId: group.id,
        name,
        phone: cleanPhone,
        otpHash: hashBorrowerOtp(otpCode, getOtpSecret()),
        role: 'chit_invite_otp',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${BORROWER_OTP_TTL_SECONDS}s`)
        .sign(getJwtSecret());

      cookieStore.set('chit_invite_otp', challenge, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: BORROWER_OTP_TTL_SECONDS,
      });

      const host = req.headers.get('host');
      const isExcluded = await isSamuraiExcludedDomain({ host, tenantId: group.tenantId });
      if (!isExcluded) {
        sendWhatsAppAuthOtp({
          phone: cleanPhone,
          tenantId: group.tenantId,
          host,
          purpose: 'borrower_login',
          customerId: `invite:${group.id}:${cleanPhone}`,
          otpCode,
        }).catch((err) => console.error('[chits/invite] WhatsApp OTP error:', err));
      }

      return NextResponse.json({
        ok: true,
        otpSent: true,
        message: 'OTP sent to your WhatsApp number.',
        ...(process.env.NODE_ENV !== 'production' ? { testOtp: otpCode } : {}),
      });
    }

    if (action === 'verify_and_join') {
      const challengeCookie = cookieStore.get('chit_invite_otp')?.value;
      if (!challengeCookie) {
        return NextResponse.json({ error: 'OTP expired — request a new OTP.' }, { status: 400 });
      }
      let otpPayload: any;
      try {
        otpPayload = (await jwtVerify(challengeCookie, getJwtSecret())).payload;
      } catch {
        return NextResponse.json({ error: 'OTP session expired — request a new OTP.' }, { status: 400 });
      }
      if (
        otpPayload.role !== 'chit_invite_otp' ||
        otpPayload.tenantId !== group.tenantId ||
        otpPayload.groupId !== group.id ||
        otpPayload.phone !== cleanPhone ||
        !verifyBorrowerOtp({ otp: String(body?.otp || ''), expectedHash: otpPayload.otpHash, secret: getOtpSecret() })
      ) {
        return NextResponse.json({ error: 'Incorrect OTP code.' }, { status: 401 });
      }

      const finalName = String(otpPayload.name || name || `Member ${cleanPhone.slice(-4)}`).trim();
      const customer = await findOrCreateInvitedCustomer(group.tenantId, group.branchId, finalName, cleanPhone);
      await enrollCustomerIntoGroup(group, customer.id, customer.name);

      const firstLoan = await prisma.loan.findFirst({
        where: { customerId: customer.id, status: 'active' },
        select: { id: true },
      });
      const sessionToken = await new SignJWT({
        loanId: firstLoan?.id || '',
        tenantId: group.tenantId,
        customerId: customer.id,
        role: 'borrower',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(getJwtSecret());

      cookieStore.set('borrower_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24,
      });
      cookieStore.delete('chit_invite_otp');

      return NextResponse.json({
        ok: true,
        redirectUrl: `/borrower/chits/${group.id}/room`,
      });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed to process invite' }, { status: 400 });
  }
}

async function findOrCreateInvitedCustomer(
  tenantId: string,
  branchId: string | null,
  name: string,
  phone: string,
) {
  const candidates = [phone, `91${phone}`, `+91${phone}`];
  const existing = await prisma.customer.findFirst({
    where: {
      tenantId,
      appType: 'chitfunds',
      phone: { in: candidates },
      deletedAt: null,
      ...(branchId ? { branchId } : {}),
    },
    select: { id: true, name: true },
  });
  if (existing) return existing;

  return prisma.customer.create({
    data: {
      tenantId,
      appType: 'chitfunds',
      branchId: branchId || undefined,
      customerCode: `CUST-${randomUUID().slice(0, 8).toUpperCase()}`,
      name,
      phone,
      status: 'active',
    },
    select: { id: true, name: true },
  });
}

async function enrollCustomerIntoGroup(group: any, customerId: string, customerName: string) {
  await prisma.$transaction(async (tx) => {
    const existingMember = await tx.chitMember.findFirst({
      where: { chitGroupId: group.id, customerId },
      select: { id: true },
    });
    if (existingMember) return existingMember;

    const currentMembers = await tx.chitMember.findMany({
      where: { chitGroupId: group.id },
      select: { memberNumber: true, ticketNo: true },
      orderBy: { memberNumber: 'asc' },
    });
    if (currentMembers.length >= group.totalMembers) {
      throw new Error('This chit group is already full.');
    }

    const usedNumbers = new Set(currentMembers.map((m) => m.memberNumber));
    let nextNum = 1;
    while (usedNumbers.has(nextNum)) nextNum += 1;

    const created = await tx.chitMember.create({
      data: {
        chitGroupId: group.id,
        customerId,
        memberNumber: nextNum,
        ticketNo: String(nextNum),
        ticketShare: 1,
        subscriberStatus: 'active',
        agreementStatus: group.chitType === 'registered' ? 'pending' : 'signed',
        agreementSignedAt: group.chitType === 'registered' ? null : new Date(),
      },
    });

    // If group is already active, generate subscriptions for all future/pending periods
    if (group.status === 'active') {
      const freq = parseFrequency(group);
      const base = roundMoney(Number(group.monthlyContrib));
      for (let period = 1; period <= group.totalMembers; period++) {
        await tx.chitSubscription.create({
          data: {
            memberId: created.id,
            periodNumber: period,
            dueDate: nextPeriodDate(group.startDate, period, freq),
            dueAmount: base,
            baseDueAmount: base,
            status: 'upcoming',
          },
        });
      }
    }

    await tx.chitRoomMessage.create({
      data: {
        tenantId: group.tenantId,
        chitGroupId: group.id,
        senderMemberId: created.id,
        senderName: customerName,
        visibility: 'public',
        messageType: 'system_notice',
        body: `${customerName} (Ticket #${nextNum}) joined via WhatsApp invite link.`,
      },
    });

    return created;
  });
}
