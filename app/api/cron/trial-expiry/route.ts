import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { authorizeCron } from '@/lib/cronAuth';
import { isUnpaidExpiredTrial } from '@/lib/subscription';
import { downgradeToFree } from '@/lib/trialExpiry';

// Daily cron. Moves tenants whose trial ended unpaid onto the Free plan (Free
// limits + feature checklist; extra branches/agents locked). Reads also settle
// a tenant lazily, so this sweep only guarantees idle tenants are handled too.
// Auth: `Authorization: Bearer <CRON_SECRET>`.
export async function GET(req: NextRequest) {
  const denied = authorizeCron(req);
  if (denied) return denied;

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
