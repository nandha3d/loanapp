import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { depositToOffice, InsufficientFloatError } from '@/lib/wallet';
import { writeAudit } from '@/lib/audit';

/**
 * POST /api/v1/wallet/deposit
 * Agent hands collected cash back to the office. Debits their float, credits
 * the branch pool. Body: { amount, note? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const body = (await req.json().catch(() => null)) as
      | { amount?: number | string; note?: string }
      | null;
    const amount = Number(body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return fail('A positive amount is required', 400);
    }

    // Resolve the agent's branch (deposits feed that branch's pool).
    const branchId =
      ctx.branchId ??
      (await prisma.user
        .findUnique({ where: { id: ctx.userId }, select: { branchId: true } })
        .then((u) => u?.branchId ?? null));
    if (!branchId) return fail('No branch assigned to deposit into', 400);

    const { agentBalance } = await depositToOffice({
      tenantId: ctx.tenantId,
      agentId: ctx.userId,
      branchId,
      amount,
      byUserId: ctx.userId,
      note: body?.note ?? null,
    });

    await writeAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'wallet_deposit',
      entityType: 'agent_account',
      entityId: ctx.userId,
      newValue: { amount, agentBalance },
    });

    return ok({ agentBalance });
  } catch (e: any) {
    if (e instanceof InsufficientFloatError) {
      return fail(`insufficient_float: balance ₹${e.available} < deposit ₹${e.required}`, 402);
    }
    return fail(e?.message ?? 'Deposit failed', 500);
  }
}
