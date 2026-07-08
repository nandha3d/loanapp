import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { injectBranchCash } from '@/lib/wallet';
import { writeAudit } from '@/lib/audit';

/**
 * GET  /api/v1/wallet/branch  → branch cash pools (admin scoped, superadmin all).
 * POST /api/v1/wallet/branch  → inject capital into a branch pool. { branchId, amount, note? }
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const branches = await prisma.branch.findMany({
      where: { tenantId: ctx.tenantId, ...scopedBranchWhere(ctx) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    const accounts = await prisma.branchCashAccount.findMany({
      where: { tenantId: ctx.tenantId, appType: ctx.appType, branchId: { in: branches.map((b) => b.id) } },
      select: { branchId: true, balance: true },
    });
    const balMap = new Map(accounts.map((a) => [a.branchId, Number(a.balance)]));

    return ok(
      branches.map((b) => ({
        branchId: b.id,
        branchName: b.name,
        balance: balMap.get(b.id) ?? 0,
      })),
    );
  } catch (e: any) {
    return fail(e?.message ?? 'Branch pool lookup failed', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const body = (await req.json().catch(() => null)) as
      | { branchId?: string; amount?: number | string; note?: string }
      | null;
    const branchId = String(body?.branchId || '');
    const amount = Number(body?.amount);
    if (!branchId || !Number.isFinite(amount) || amount <= 0) {
      return fail('branchId and a positive amount are required', 400);
    }

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!branch) return fail('Branch not found', 404);

    const { branchBalance } = await injectBranchCash({
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      branchId,
      amount,
      byUserId: ctx.userId,
      note: body?.note ?? null,
    });

    await writeAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'wallet_inject',
      entityType: 'branch_cash_account',
      entityId: branchId,
      newValue: { amount, branchBalance },
    });

    return ok({ branchId, branchBalance });
  } catch (e: any) {
    return fail(e?.message ?? 'Branch top-up failed', 500);
  }
}
