import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import prisma from '@/lib/db';
import { apiError } from '@/lib/utils';

/**
 * GET /api/cron/gps-purge
 *
 * Deletes raw agent movement pings older than the retention horizon.
 * Collection geo-stamps on collection_entries are NEVER touched — they are
 * audit evidence; only bulk movement telemetry expires.
 *
 * Retention horizon: AppSetting `gps_retention_days` per tenant (default 90).
 * Runs daily; secure with Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return apiError('CRON_SECRET not configured', 500);

  const authHeader = request.headers.get('authorization');
  const provided = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';
  const expectedBuf = Buffer.from(cronSecret);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Cron lock — prevent concurrent runs
  const lockId = 'gps_purge';
  const now = new Date();
  const existing = await prisma.cronLock.findUnique({ where: { id: lockId } });
  if (existing && existing.expiresAt > now) {
    return apiError('gps-purge already running', 429);
  }
  await prisma.cronLock.upsert({
    where: { id: lockId },
    create: { id: lockId, lockedAt: now, expiresAt: new Date(now.getTime() + 15 * 60_000) },
    update: { lockedAt: now, expiresAt: new Date(now.getTime() + 15 * 60_000) },
  });

  const DEFAULT_RETENTION_DAYS = 90;
  const results: Array<{ tenantId: string; retentionDays: number; deleted: number }> = [];

  try {
    // Per-tenant retention override via AppSetting gps_retention_days.
    const overrides = await prisma.appSetting.findMany({
      where: { key: 'gps_retention_days' },
      select: { tenantId: true, value: true },
    });
    const overrideMap = new Map(
      overrides.map((o) => {
        const days = parseInt(o.value, 10);
        return [o.tenantId, Number.isFinite(days) && days > 0 ? days : DEFAULT_RETENTION_DAYS];
      }),
    );

    // Tenants with a custom horizon — purge each separately.
    for (const [tenantId, days] of overrideMap.entries()) {
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const { count } = await prisma.agentLocationPing.deleteMany({
        where: { tenantId, capturedAt: { lt: cutoff } },
      });
      if (count > 0) results.push({ tenantId, retentionDays: days, deleted: count });
    }

    // Everyone else — default horizon in one statement.
    const defaultCutoff = new Date(now.getTime() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const { count: defaultDeleted } = await prisma.agentLocationPing.deleteMany({
      where: {
        capturedAt: { lt: defaultCutoff },
        ...(overrideMap.size > 0 ? { tenantId: { notIn: [...overrideMap.keys()] } } : {}),
      },
    });
    if (defaultDeleted > 0) {
      results.push({ tenantId: '*default*', retentionDays: DEFAULT_RETENTION_DAYS, deleted: defaultDeleted });
    }

    return NextResponse.json({
      success: true,
      runDate: now.toISOString(),
      totalDeleted: results.reduce((s, r) => s + r.deleted, 0),
      results,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'gps-purge failed', 500);
  } finally {
    await prisma.cronLock.delete({ where: { id: lockId } }).catch(() => {});
  }
}
