import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { cleanupExpiredRateLimits } from '@/lib/rateLimit';

/**
 * GET /api/cron/accrue-penalties
 *
 * Scans all active/overdue loans and creates or updates Penalty records
 * for instalments that are missed (past due date, not paid/partial).
 *
 * Protect this route with a shared secret via the CRON_SECRET env var.
 * Set up a daily cron job (e.g. Vercel Cron, GitHub Actions, or an OS cron)
 * to call: GET /api/cron/accrue-penalties
 * with the header:  Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  // Validate cron secret (must be set in env)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // Phase 1.8: Cron locking to prevent concurrent accrual runs
    const lockId = 'penalty_accrual';
    const lockExpiryMinutes = 5;
    const now = new Date();

    const existingLock = await prisma.cronLock.findUnique({ where: { id: lockId } });
    if (existingLock && existingLock.expiresAt > now) {
      return NextResponse.json({ message: 'Cron job already running or recently completed.' }, { status: 429 });
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

    // Find all instalments that are overdue and unpaid
    const overdueInstalments = await prisma.instalment.findMany({
      where: {
        dueDate: { lt: today },
        status: { in: ['upcoming', 'missed'] },
        loan: { status: { in: ['active', 'overdue'] } },
      },
      include: {
        loan: {
          include: {
            tenant: {
              include: { settings: { where: { key: { in: ['default_penalty_per_day', 'penalty_grace_period', 'penalty_max_cap'] } } } },
            },
          },
        },
      },
    });

    // Group by loanId so we create one Penalty record per loan
    const loanMap = new Map<string, typeof overdueInstalments>();
    for (const inst of overdueInstalments) {
      const arr = loanMap.get(inst.loanId) ?? [];
      arr.push(inst);
      loanMap.set(inst.loanId, arr);
    }

    let created = 0;
    let updated = 0;

    for (const [loanId, instalments] of loanMap) {
      const loan = instalments[0].loan;
      const settings = Object.fromEntries(
        loan.tenant.settings.map((s) => [s.key, s.value])
      );
      const penaltyPerDay = Number(settings['default_penalty_per_day'] ?? 0);
      const gracePeriodDays = Number(settings['penalty_grace_period'] ?? 0);
      const maxCap = Number(settings['penalty_max_cap'] ?? 0);

      if (penaltyPerDay <= 0) continue; // Penalty not configured for this tenant

      // Count total missed days across all overdue instalments, respecting grace period
      let totalMissedDays = 0;
      for (const inst of instalments) {
        const daysOverdue = Math.floor(
          (today.getTime() - new Date(inst.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        const effectiveDays = Math.max(0, daysOverdue - gracePeriodDays);
        totalMissedDays += effectiveDays;
      }

      if (totalMissedDays === 0) continue;

      let grossPenalty = totalMissedDays * penaltyPerDay;
      if (maxCap > 0) {
        grossPenalty = Math.min(grossPenalty, maxCap);
      }

      // Upsert penalty record per loan (one aggregate penalty per loan)
      const existing = await prisma.penalty.findFirst({
        where: { loanId, status: { in: ['pending', 'partial'] } },
      });

      if (existing) {
        // Only update if penalty has grown
        if (grossPenalty > Number(existing.grossPenalty)) {
          await prisma.penalty.update({
            where: { id: existing.id },
            data: { missedDays: totalMissedDays, grossPenalty },
          });
          updated++;
        }
      } else {
        await prisma.penalty.create({
          data: {
            loanId,
            customerId: loan.customerId,
            missedDays: totalMissedDays,
            grossPenalty,
            status: 'pending',
          },
        });
        created++;
      }

      // Mark the loan as overdue if it isn't already
      if (loan.status === 'active') {
        await prisma.loan.update({
          where: { id: loanId },
          data: { status: 'overdue' },
        });
      }

      // Mark each instalment as missed
      await prisma.instalment.updateMany({
        where: { loanId, status: 'upcoming', dueDate: { lt: today } },
        data: { status: 'missed' },
      });
    }

    // ── Midnight ledger lock ──────────────────────────────────────────
    // Lock all DailyCollection records that belong to yesterday (still open)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const locked = await prisma.dailyCollection.updateMany({
      where: { date: yesterday, status: 'open' },
      data: { status: 'locked', lockedAt: new Date() },
    });
    // ─────────────────────────────────────────────────────────────────

    // ── Cleanup expired rate-limit rows ──────────────────────────────────
    const rateLimitCleaned = await cleanupExpiredRateLimits();
    // ─────────────────────────────────────────────────────────────────────

    return NextResponse.json({
      ok: true,
      loansProcessed: loanMap.size,
      penaltiesCreated: created,
      penaltiesUpdated: updated,
      dailyCollectionsLocked: locked.count,
      rateLimitRecordsCleaned: rateLimitCleaned,
      runAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[accrue-penalties]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
