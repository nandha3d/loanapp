import { NextRequest, NextResponse } from 'next/server';
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
  // Primary: use the project-standard authorizeCron (Bearer token)
  const denied = authorizeCron(req as unknown as Request);
  if (denied) {
    // Fallback: check x-cron-secret header for alternate callers
    const secret = req.headers.get('x-cron-secret');
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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
