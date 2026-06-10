import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import prisma from '@/lib/db';
import { presentPayment, findInstalmentsForAutoPresent } from '@/lib/nach';
import { apiError } from '@/lib/utils';

/**
 * GET /api/cron/nach-present
 *
 * Auto-present NACH debits for instalments due within 2 days.
 * Runs daily at 8:00 AM (configurable in your cron scheduler).
 * Skips instalments that already have a pending/submitted/success presentation.
 *
 * Secure with Authorization: Bearer <CRON_SECRET>
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
  const lockId = 'nach_present';
  const now = new Date();
  const existing = await prisma.cronLock.findUnique({ where: { id: lockId } });
  if (existing && existing.expiresAt > now) {
    return apiError('nach-present already running', 429);
  }
  await prisma.cronLock.upsert({
    where: { id: lockId },
    create: { id: lockId, lockedAt: now, expiresAt: new Date(now.getTime() + 15 * 60_000) },
    update: { lockedAt: now, expiresAt: new Date(now.getTime() + 15 * 60_000) },
  });

  const instalments = await findInstalmentsForAutoPresent();

  const results: Array<{ instalmentId: string; loanId: string; status: string; error?: string }> = [];

  for (const inst of instalments) {
    const mandate = inst.loan.nachMandate;
    if (!mandate) continue;

    // Skip if presentation already exists for this instalment
    const existing = await prisma.nachPresentation.findFirst({
      where: {
        mandateId: mandate.id,
        instalmentId: inst.id,
        status: { in: ['pending', 'submitted', 'success'] },
      },
    });
    if (existing) continue;

    const outstanding = Number(inst.dueAmount) - Number(inst.receivedAmount);
    if (outstanding <= 0) continue;

    try {
      const result = await presentPayment({
        mandateId: mandate.id,
        instalmentId: inst.id,
        amount: outstanding,
        description: `EMI auto-debit – ${inst.loan.loanCode ?? inst.loanId} – Due ${inst.dueDate.toISOString().slice(0, 10)}`,
      });
      results.push({ instalmentId: inst.id, loanId: inst.loanId, status: 'submitted', ...result });
    } catch (e) {
      results.push({
        instalmentId: inst.id,
        loanId: inst.loanId,
        status: 'error',
        error: e instanceof Error ? e.message : 'unknown',
      });
    }
  }

  // Release lock
  await prisma.cronLock.delete({ where: { id: lockId } }).catch(() => {});

  return NextResponse.json({
    success: true,
    runDate: now.toISOString(),
    presented: results.filter(r => r.status === 'submitted').length,
    errors: results.filter(r => r.status === 'error').length,
    results,
  });
}
