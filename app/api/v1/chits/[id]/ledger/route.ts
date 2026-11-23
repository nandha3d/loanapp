import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { buildChitGroupDividendLedger } from '@/lib/chits/memberDividendLedger';

// Detailed group + per-member dividend ledger (STABLE-8: all math server-side).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  try {
    const ledger = await buildChitGroupDividendLedger(id, {
      tenantId: ctx.tenantId,
      appType: 'chitfunds',
      branchId: ctx.branchId,
      role: ctx.role,
      userId: ctx.userId,
    });
    if (!ledger) return fail('Chit group not found', 404);
    return ok(ledger);
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to build chit dividend ledger', 500);
  }
}
