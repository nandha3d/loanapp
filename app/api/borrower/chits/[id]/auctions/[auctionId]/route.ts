import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getBorrowerSession } from '@/lib/borrowerAuth';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import { findOwnLiveAuction, buildCustomerLiveState } from '@/lib/chits/customerAuction';
import { placeChitBid, type ChitBidSource } from '@/lib/chits/bidService';
import { joinAuctionRoomAttendance } from '@/lib/chits/attendanceAuto';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  detectMimeTypeFromBytes,
  isAudioMime,
  maxUploadSizeFor,
  storeTenantUpload,
  validateFileBytes,
} from '@/lib/fileUpload';

// Cookie-authenticated borrower portal API for the Member Live Auction & Chat Room
// (parallel to /api/v1/borrower/chits/[id]/auctions/[auctionId]/* for mobile JWTs).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const session = await getBorrowerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, auctionId } = await params;

  try {
    const found = await findOwnLiveAuction(session.customerId, session.tenantId, id, auctionId);
    if (!found) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });

    const state = await buildCustomerLiveState(id, auctionId, found.member.id);
    if (!state) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    return NextResponse.json({ ok: true, state });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to load live auction room' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const session = await getBorrowerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, auctionId } = await params;

  try {
    const found = await findOwnLiveAuction(session.customerId, session.tenantId, id, auctionId);
    if (!found) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    const { member, auction } = found;

    const contentType = req.headers.get('content-type') || '';

    // 1. Voice clip upload via multipart/form-data
    if (contentType.includes('multipart/form-data')) {
      const rl = await checkRateLimit(routeKey('borrower-web:room-voice', getClientIp(req)), {
        limit: 30,
        windowMs: 5 * 60 * 1000,
      });
      if (!rl.allowed) return NextResponse.json({ error: 'Too many voice notes — slow down' }, { status: 429 });

      const formData = await req.formData();
      const audio = formData.get('audio');
      if (!(audio instanceof File) || audio.size <= 0) {
        return NextResponse.json({ error: 'Voice clip is required' }, { status: 400 });
      }
      const rawMime = (audio.type || 'audio/webm').split(';')[0].trim().toLowerCase();
      const buffer = Buffer.from(await audio.arrayBuffer());
      const effectiveMime =
        isAudioMime(rawMime) && ALLOWED_UPLOAD_MIME_TYPES.includes(rawMime) && validateFileBytes(buffer, rawMime)
          ? rawMime
          : detectMimeTypeFromBytes(buffer) ?? '';

      if (!effectiveMime || !isAudioMime(effectiveMime) || !ALLOWED_UPLOAD_MIME_TYPES.includes(effectiveMime)) {
        return NextResponse.json({ error: 'Unsupported voice format' }, { status: 400 });
      }
      if (buffer.byteLength > maxUploadSizeFor(effectiveMime)) {
        return NextResponse.json({ error: 'Voice clip exceeds 1 MB limit' }, { status: 400 });
      }

      const stored = await storeTenantUpload({
        tenantId: session.tenantId,
        mimeType: effectiveMime,
        buffer,
        prefix: 'voice',
      });
      const transcript = String(formData.get('transcript') ?? '').trim().slice(0, 500);
      const durNum = Number(formData.get('durationSec'));
      const audioDurationSec = Number.isFinite(durNum) && durNum > 0 ? Math.min(300, Math.round(durNum)) : null;

      const customer = await prisma.customer.findUnique({
        where: { id: session.customerId },
        select: { name: true },
      });

      const message = await prisma.chitRoomMessage.create({
        data: {
          tenantId: session.tenantId,
          auctionId,
          senderMemberId: member.id,
          senderName: customer?.name || 'Member',
          visibility: 'public',
          messageType: 'voice',
          body: transcript || '🎤 Voice message',
          audioUrl: stored.url,
          audioDurationSec,
        },
        select: {
          id: true,
          senderName: true,
          visibility: true,
          messageType: true,
          body: true,
          audioUrl: true,
          audioDurationSec: true,
          createdAt: true,
        },
      });
      return NextResponse.json({ ok: true, message });
    }

    // 2. JSON actions: join | bid | message
    const body = (await req.json().catch(() => null)) as Record<string, any> | null;
    const action = String(body?.action || '');

    if (action === 'join') {
      if (auction.roomStatus === 'closed' || ['confirmed', 'paid', 'cancelled'].includes(auction.status)) {
        return NextResponse.json({ error: 'Bidding room is closed' }, { status: 400 });
      }
      if (member.hasWon) {
        return NextResponse.json({ error: 'This ticket has already won and cannot rejoin' }, { status: 400 });
      }
      if (member.subscriberStatus !== 'active') {
        return NextResponse.json({ error: 'Member ticket is not active' }, { status: 403 });
      }
      const { admissionStatus } = await joinAuctionRoomAttendance({
        tenantId: session.tenantId,
        branchId: auction.chitGroup.branchId,
        auctionId,
        memberId: member.id,
        roomAdmission: auction.chitGroup.roomAdmission,
      });
      return NextResponse.json({ ok: true, admissionStatus });
    }

    if (action === 'message') {
      const rl = await checkRateLimit(routeKey('borrower-web:room-msg', getClientIp(req)), {
        limit: 40,
        windowMs: 60 * 1000,
      });
      if (!rl.allowed) return NextResponse.json({ error: 'Too many messages — slow down' }, { status: 429 });

      const text = String(body?.body ?? '').trim();
      if (!text) return NextResponse.json({ error: 'Message body required' }, { status: 400 });
      if (text.length > 500) return NextResponse.json({ error: 'Message too long (max 500 chars)' }, { status: 400 });

      const customer = await prisma.customer.findUnique({
        where: { id: session.customerId },
        select: { name: true },
      });
      const message = await prisma.chitRoomMessage.create({
        data: {
          tenantId: session.tenantId,
          auctionId,
          senderMemberId: member.id,
          senderName: customer?.name || 'Member',
          visibility: 'public',
          messageType: 'text',
          body: text,
        },
        select: {
          id: true,
          senderName: true,
          visibility: true,
          messageType: true,
          body: true,
          audioUrl: true,
          audioDurationSec: true,
          createdAt: true,
        },
      });
      return NextResponse.json({ ok: true, message });
    }

    if (action === 'bid') {
      const rl = await checkRateLimit(routeKey('borrower-web:chit-bid', getClientIp(req)), {
        limit: 30,
        windowMs: 60 * 1000,
      });
      if (!rl.allowed) return NextResponse.json({ error: 'Too many bid attempts — slow down' }, { status: 429 });

      const prizeAmount = Number(body?.prizeAmount);
      const idempotencyKey = body?.idempotencyKey ? String(body.idempotencyKey) : '';
      const source: ChitBidSource = body?.source === 'voice' ? 'voice' : 'tap';
      const transcript = body?.transcript ? String(body.transcript).slice(0, 500) : null;
      if (!Number.isFinite(prizeAmount) || prizeAmount <= 0) {
        return NextResponse.json({ error: 'Valid prizeAmount is required' }, { status: 400 });
      }
      if (!idempotencyKey) {
        return NextResponse.json({ error: 'idempotencyKey is required' }, { status: 400 });
      }

      if (auction.chitGroup.roomAdmission === 'approval') {
        const attendance = await prisma.chitAuctionAttendance.findUnique({
          where: { auctionId_memberId: { auctionId, memberId: member.id } },
          select: { admissionStatus: true },
        });
        if (attendance?.admissionStatus !== 'admitted') {
          return NextResponse.json(
            { error: 'Wait for the organizer to admit you to the room before bidding' },
            { status: 403 },
          );
        }
      }

      const bid = await prisma.$transaction((tx) =>
        placeChitBid(tx, {
          auction,
          member,
          prizeAmount,
          source,
          transcript,
          idempotencyKey,
          createdById: null,
          tenantId: session.tenantId,
        }),
      );
      return NextResponse.json({
        ok: true,
        bid: {
          id: bid.id,
          memberId: bid.memberId,
          bidAmount: Number(bid.bidAmount),
          bidDiscount: Number(bid.bidDiscount),
          status: bid.status,
        },
      });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Request failed' }, { status: 400 });
  }
}
