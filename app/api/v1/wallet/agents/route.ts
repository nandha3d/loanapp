import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

/**
 * GET /api/v1/wallet/agents
 * Admin/superadmin view: every active agent with their current float balance.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const agents = await prisma.user.findMany({
      where: {
        tenantId: ctx.tenantId,
        role: 'agent',
        status: 'active',
        ...scopedBranchWhere(ctx),
      },
      select: { id: true, name: true, phone: true, branchId: true },
      orderBy: { name: 'asc' },
    });

    const accounts = await prisma.agentAccount.findMany({
      where: { tenantId: ctx.tenantId, agentId: { in: agents.map((a) => a.id) } },
      select: { agentId: true, balance: true },
    });
    const balanceMap = new Map(accounts.map((a) => [a.agentId, Number(a.balance)]));

    return ok(
      agents.map((a) => ({
        agentId: a.id,
        name: a.name,
        phone: a.phone,
        branchId: a.branchId,
        balance: balanceMap.get(a.id) ?? 0,
      })),
    );
  } catch (e: any) {
    return fail(e?.message ?? 'Agent wallet list failed', 500);
  }
}
