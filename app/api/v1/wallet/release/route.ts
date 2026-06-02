import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { releaseToAgent } from '@/lib/wallet';
import { writeAudit } from '@/lib/audit';

/**
 * POST /api/v1/wallet/release
 * Admin/superadmin releases company cash into an agent's float account.
 * Body: { agentId, amount, note? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const body = (await req.json().catch(() => null)) as
      | { agentId?: string; amount?: number | string; note?: string }
      | null;
    const agentId = String(body?.agentId || '');
    const amount = Number(body?.amount);
    if (!agentId || !Number.isFinite(amount) || amount <= 0) {
      return fail('agentId and a positive amount are required', 400);
    }

    const agent = await prisma.user.findFirst({
      where: { id: agentId, tenantId: ctx.tenantId, role: 'agent', status: 'active' },
      select: { id: true, branchId: true },
    });
    if (!agent) return fail('Agent not found', 404);

    const { agentBalance } = await releaseToAgent({
      tenantId: ctx.tenantId,
      agentId,
      branchId: agent.branchId ?? ctx.branchId ?? null,
      amount,
      byUserId: ctx.userId,
      note: body?.note ?? null,
    });

    await writeAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'wallet_release',
      entityType: 'agent_account',
      entityId: agentId,
      newValue: { amount, agentBalance },
    });

    return ok({ agentId, agentBalance });
  } catch (e: any) {
    return fail(e?.message ?? 'Fund release failed', 500);
  }
}
