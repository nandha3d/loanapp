import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { authorizeCron } from '@/lib/cronAuth';
import { runNpaClassification } from '@/lib/npa/npaClassifier';
import { apiError } from '@/lib/utils';

/**
 * GET /api/cron/npa-classify
 *
 * Full NPA classification engine. Runs daily at 2:00 AM (after penalty accrual at 1:00 AM).
 * Classifies all active/NPA loans into RBI asset categories:
 *   Standard → SMA-0 → SMA-1 → SMA-2 → Sub-Standard → Doubtful D1/D2/D3 → Loss
 *
 * Only processes tenants with npaEnabled = true in their subscription.
 *
 * Protect with CRON_SECRET via Authorization: Bearer <secret>
 */
export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  try {
    // Cron locking to prevent concurrent NPA classification runs
    const lockId = 'npa_classification';
    const lockExpiryMinutes = 10;
    const now = new Date();

    const existingLock = await prisma.cronLock.findUnique({ where: { id: lockId } });
    if (existingLock && existingLock.expiresAt > now) {
      return apiError('NPA classification job already running or recently completed.', 429);
    }

    await prisma.cronLock.upsert({
      where: { id: lockId },
      create: {
        id: lockId,
        lockedAt: now,
        expiresAt: new Date(now.getTime() + lockExpiryMinutes * 60000),
      },
      update: {
        lockedAt: now,
        expiresAt: new Date(now.getTime() + lockExpiryMinutes * 60000),
      },
    });

    // Only process tenants with npaEnabled = true
    const enabledSubscriptions = await prisma.tenantSubscription.findMany({
      where: { npaEnabled: true },
      select: { tenantId: true },
    });

    const tenantIds = enabledSubscriptions.map((s) => s.tenantId);

    // Get tenant details for reporting
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds }, status: 'active' },
      select: { id: true, name: true },
    });

    const results: Record<string, unknown>[] = [];

    for (const tenant of tenants) {
      try {
        const result = await runNpaClassification(tenant.id, 'cron_auto');
        results.push({ tenantId: tenant.id, tenantName: tenant.name, ...result });
      } catch (err) {
        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          error: (err as Error).message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      runDate: new Date().toISOString(),
      tenantsProcessed: tenants.length,
      results,
    });
  } catch (err) {
    console.error('[npa-classify]', err);
    return apiError('Internal server error', 500);
  }
}
