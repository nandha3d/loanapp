import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { canCreateLoanForRole } from '@/lib/loanPolicy';
import { getOriginationFunding } from '@/lib/loanFunding';

/**
 * POST /api/v1/loans/funding — FUND-1.
 * Body: { amount, customerId? }. `amount` is the net cash payout the loan
 * preview (/loans/calculate) returned. Answers whether the caller's funding
 * source covers it: an agent's own float, or the pool of the branch the loan
 * would sit on. Read-only; origination re-checks under its own transaction
 * (MONEY-16), so this only drives the clients' warning and popup.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!canCreateLoanForRole(ctx.role)) return fail('Forbidden', 403);

  const body = (await req.json().catch(() => null)) as { amount?: unknown; customerId?: unknown } | null;
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount < 0) return fail('amount must be a non-negative number', 400);
  const customerId = typeof body?.customerId === 'string' && body.customerId ? body.customerId : null;
  try {
    return ok(await getOriginationFunding(ctx, { amount, customerId }));
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Funding check failed', 500);
  }
}
