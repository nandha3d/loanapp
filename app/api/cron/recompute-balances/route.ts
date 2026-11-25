import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@/lib/db';
import { recomputeBalancesForPeriod } from '@/lib/accounting/balances';
import { getPeriodKey } from '@/lib/accounting/premium';
import { authorizeCron } from '@/lib/cronAuth';

/**
 * GET /api/cron/recompute-balances
 *
 * Recomputes account_balances for the current month for all active tenants
 * with premium accounting enabled.
 *
 * Secured via Authorization: Bearer <CRON_SECRET> header.
 * Also accepts x-cron-secret header for compatibility.
 */
export async function GET(req: NextRequest) {
  // Primary: use the project-standard authorizeCron (Bearer token + IP allowlist).
  const denied = authorizeCron(req as unknown as Request);
  if (denied) {
    // Never bypass an explicit IP allowlist denial (403) or missing CRON_SECRET (500).
    if (denied.status !== 401) return denied;
    const cronSecret = process.env.CRON_SECRET ?? '';
    const secret = req.headers.get('x-cron-secret') ?? '';
    const a = Buffer.from(cronSecret);
    const b = Buffer.from(secret);
    if (!cronSecret || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return denied;
    }
    // Re-run IP allowlist check for x-cron-secret callers via a synthetic Bearer header.
    const allowlistCheck = authorizeCron(
      new Request(req.url, {
        headers: new Headers([
          ...req.headers.entries(),
          ['authorization', `Bearer ${cronSecret}`],
        ]),
      }),
    );
    if (allowlistCheck) return allowlistCheck;
  }

  const periodKey = getPeriodKey(new Date());

  // Find all tenants with premium accounting enabled
  const subs = await prisma.tenantSubscription.findMany({
    where: { premiumAccountingEnabled: true },
    select: { tenantId: true },
  });

  const results: { tenantId: string; ok: boolean; error?: string }[] = [];

  for (const sub of subs) {
    try {
      // recomputeBalancesForPeriod accepts a PrismaClient-compatible tx-like client as first arg
      await recomputeBalancesForPeriod(prisma as any, sub.tenantId, periodKey);
      results.push({ tenantId: sub.tenantId, ok: true });
    } catch (e) {
      results.push({ tenantId: sub.tenantId, ok: false, error: String(e) });
    }
  }

  return NextResponse.json({ periodKey, results });
}
