import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import prisma from '@/lib/db';
import { isUnpaidExpiredTrial } from '@/lib/subscription';
import { downgradeToFree } from '@/lib/trialExpiry';

// Daily cron. Moves tenants whose trial ended unpaid onto the Free plan (Free
// limits + feature checklist; extra branches/agents locked). Reads also settle
// a tenant lazily, so this sweep only guarantees idle tenants are handled too.
// Auth: `Authorization: Bearer <CRON_SECRET>`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  const header = req.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(secret);
  const b = Buffer.from(provided);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const candidates = await prisma.tenantSubscription.findMany({
    where: { plan: { notIn: ['free', 'lifetime'] } },
    include: { tenant: { select: { customDomain: true } } },
  });

  let downgraded = 0;
  for (const sub of candidates) {
    if (!isUnpaidExpiredTrial(sub)) continue;
    if (await downgradeToFree(sub.tenantId)) downgraded += 1;
  }
  return NextResponse.json({ ok: true, checked: candidates.length, downgraded });
}
