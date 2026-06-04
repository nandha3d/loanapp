import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import { reconcileSelfPayToken, claimSelfPayToken } from '@/lib/selfPay';

/**
 * POST /api/borrower/self-pay/confirm  { token }
 * Mock/demo mode: simulates a PSP capture and reconciles immediately.
 * Production: never trusts the client for money — records a `claimed` flag for
 * one-tap staff verification (Tier-0 UPI). Real PSP captures reconcile via the
 * signed webhook instead.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(routeKey('selfpay:confirm', ip), { limit: 20, windowMs: 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const { token } = (await req.json()) as { token?: string };
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

    const mock = process.env.RAZORPAY_MOCK_CHECKOUT === 'true';
    if (mock) {
      // Demo: simulate a PSP capture and reconcile immediately.
      const result = await reconcileSelfPayToken({ token, agentId: null });
      if (result.status === 'invalid') return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
      return NextResponse.json({ status: result.status, entryId: result.entryId ?? null });
    }

    // Production Tier-0: record the borrower's claim for staff verification.
    // Never posts money from a client click.
    const claim = await claimSelfPayToken(token);
    if (claim.status === 'invalid') return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    return NextResponse.json({ status: claim.status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Confirm failed' }, { status: 500 });
  }
}
