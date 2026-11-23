import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { resolveEngineTypeFromGroup } from '@/lib/chits/engineTypes';
import { createChitAudit } from '@/lib/chits/audit';

const ALLOWED_TXN_TYPES = [
  'internal_loan_disburse',
  'internal_loan_repay',
  'interest_income',
  'admin_expense',
  'maturity_distribution',
] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  try {
    const group = await prisma.chitGroup.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
        appType: 'chitfunds',
        ...scopedBranchWhere(ctx),
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!group) return fail('Chit group not found', 404);

    const rows = await prisma.chitPoolTransaction.findMany({
      where: { tenantId: ctx.tenantId, appType: 'chitfunds', chitGroupId: group.id },
      orderBy: { txnDate: 'desc' },
    });
    return ok(rows);
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to load pool transactions', 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as any;

  try {
    const group = await prisma.chitGroup.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
        appType: 'chitfunds',
        ...scopedBranchWhere(ctx),
        deletedAt: null,
      },
    });
    if (!group) return fail('Chit group not found', 404);
    if (resolveEngineTypeFromGroup(group) !== 'ASCA_SHG_REVOLVING') {
      return fail('Pool transactions apply only to ASCA / SHG Revolving Pool chits', 400);
    }

    const txnType = String(body?.txnType ?? '');
    if (!(ALLOWED_TXN_TYPES as readonly string[]).includes(txnType)) {
      return fail('Invalid pool transaction type', 400);
    }
    const principalAmount = Number(body?.principalAmount ?? 0);
    const interestAmount = Number(body?.interestAmount ?? 0);
    if (!Number.isFinite(principalAmount) || principalAmount < 0 || !Number.isFinite(interestAmount) || interestAmount < 0) {
      return fail('Amounts must be non-negative numbers', 400);
    }
    if (principalAmount === 0 && interestAmount === 0) {
      return fail('Either principalAmount or interestAmount must be greater than zero', 400);
    }
    const memberId = body?.memberId ? String(body.memberId) : null;
    if (memberId) {
      const m = await prisma.chitMember.findFirst({ where: { id: memberId, chitGroupId: group.id }, select: { id: true } });
      if (!m) return fail('Member not found in this chit group', 404);
    }

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.chitPoolTransaction.create({
        data: {
          tenantId: ctx.tenantId,
          branchId: group.branchId,
          appType: 'chitfunds',
          chitGroupId: group.id,
          memberId: memberId ?? undefined,
          txnType,
          principalAmount,
          interestAmount,
          interestRatePct: body?.interestRatePct != null ? Number(body.interestRatePct) : undefined,
          notes: body?.notes ?? undefined,
          createdById: ctx.userId,
        },
      });
      await createChitAudit(tx, {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: `asca_${txnType}`,
        entityType: 'chit_group',
        entityId: group.id,
        newValue: { txnId: row.id, txnType, memberId, principalAmount, interestAmount },
      });
      return row;
    });
    return ok(created);
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to record pool transaction', 500);
  }
}
