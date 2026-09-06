import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { notify } from '@/lib/notify/events';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function windowFromNow(startMs: number, endMs: number) {
  const now = Date.now();
  return { gte: new Date(now + startMs), lte: new Date(now + endMs) };
}

function formatScheduledAt(date: Date) {
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function sendAuctionReminder(auction: any, kind: 'day' | 'hour') {
  const event = kind === 'day' ? 'chit_auction_reminder_day' : 'chit_auction_reminder_hour';
  let sent = 0;
  for (const member of auction.chitGroup.members) {
    const customer = member.customer;
    if (!customer?.phone) continue;
    try {
      await notify({
        tenantId: auction.chitGroup.tenantId,
        event,
        phone: customer.phone,
        email: customer.email ?? undefined,
        data: {
          name: customer.name,
          groupName: auction.chitGroup.name,
          periodNumber: String(auction.periodNumber),
          scheduledAt: formatScheduledAt(auction.scheduledAt),
          chitValue: Number(auction.chitGroup.chitValue).toLocaleString('en-IN'),
        },
        meta: { entityType: 'chit_auction', entityId: auction.id },
      });
      sent++;
      await sleep(100);
    } catch (e) {
      console.error('[chit auction reminder] notify failed', e);
    }
  }
  return sent;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const include = {
    chitGroup: {
      include: {
        members: {
          where: { subscriberStatus: 'active' },
          include: { customer: { select: { name: true, phone: true, email: true } } },
        },
      },
    },
  } as const;

  const dayAuctions = await prisma.chitAuction.findMany({
    where: {
      scheduledAt: windowFromNow(23 * 60 * 60_000, 25 * 60 * 60_000),
      status: { in: ['pending', 'notice_sent'] },
      reminder1DayAt: null,
    },
    include,
    take: 100,
  });

  const hourAuctions = await prisma.chitAuction.findMany({
    where: {
      scheduledAt: windowFromNow(50 * 60_000, 70 * 60_000),
      status: { in: ['pending', 'notice_sent'] },
      reminder1HourAt: null,
    },
    include,
    take: 100,
  });

  let sent = 0;
  for (const auction of dayAuctions) {
    sent += await sendAuctionReminder(auction, 'day');
    await prisma.chitAuction.update({
      where: { id: auction.id },
      data: { reminder1DayAt: new Date() },
    });
  }
  for (const auction of hourAuctions) {
    sent += await sendAuctionReminder(auction, 'hour');
    await prisma.chitAuction.update({
      where: { id: auction.id },
      data: { reminder1HourAt: new Date() },
    });
  }

  return NextResponse.json({ sent, processedAt: new Date().toISOString() });
}
