import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { listCashHandovers } from '@/lib/cashHandover';

/**
 * GET /api/v1/wallet/handovers?status=pending — staff: handovers of agents in
 * scope; agent: own history (WAL-01).
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const status = new URL(req.url).searchParams.get('status');
  try {
    const rows = await listCashHandovers(
      { tenantId: ctx.tenantId, appType: ctx.appType, userId: ctx.userId, branchId: ctx.branchId ?? null, role: ctx.role },
      { status },
    );
    return ok(rows.map((h) => ({
      id: h.id,
      agentId: h.agentId,
      agentName: h.agent?.name ?? null,
      agentPhone: h.agent?.phone ?? null,
      amount: Number(h.amount),
      status: h.status,
      requestedAt: h.requestedAt.toISOString(),
      confirmedAt: h.confirmedAt ? h.confirmedAt.toISOString() : null,
      remarks: h.remarks ?? null,
    })));
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to load handovers', 500);
  }
}
