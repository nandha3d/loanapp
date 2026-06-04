import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const groups = await prisma.chitGroup.findMany({
      where: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        ...scopedBranchWhere(ctx),
        deletedAt: null,
      },
      include: {
        _count: { select: { members: true, auctions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return ok(groups);
  } catch (e: any) {
    return fail(e?.message ?? 'Chits failed', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const body = (await req.json().catch(() => null)) as
    | {
        name?: string;
        chitValue?: number | string;
        monthlyContrib?: number | string;
        totalMembers?: number | string;
        durationMonths?: number | string;
        commissionPct?: number | string;
        startDate?: string;
        branchId?: string | null;
      }
    | null;

  const name = body?.name?.trim();
  const chitValue = Number(body?.chitValue);
  const monthlyContrib = Number(body?.monthlyContrib);
  const totalMembers = Number(body?.totalMembers);
  const durationMonths = Number(body?.durationMonths ?? body?.totalMembers);
  const commissionPct = Number(body?.commissionPct ?? 5);
  const startDate = body?.startDate ? new Date(body.startDate) : new Date();

  if (!name) return fail('name is required', 400);
  if (!Number.isFinite(chitValue) || chitValue <= 0) return fail('chitValue must be greater than zero', 400);
  if (!Number.isFinite(monthlyContrib) || monthlyContrib <= 0) return fail('monthlyContrib must be greater than zero', 400);
  if (!Number.isInteger(totalMembers) || totalMembers <= 0) return fail('totalMembers must be a positive integer', 400);
  if (!Number.isInteger(durationMonths) || durationMonths <= 0) return fail('durationMonths must be a positive integer', 400);
  if (!Number.isFinite(commissionPct) || commissionPct < 0) return fail('commissionPct must be zero or greater', 400);
  if (Number.isNaN(startDate.getTime())) return fail('startDate is invalid', 400);

  try {
    const requestedBranchId = body?.branchId ?? ctx.branchId;
    const branchId = ctx.role === 'superadmin' || ctx.role === 'developer'
      ? requestedBranchId
      : ctx.branchId;

    const group = await prisma.chitGroup.create({
      data: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        branchId: branchId || null,
        name,
        chitValue,
        monthlyContrib,
        totalMembers,
        durationMonths,
        commissionPct,
        startDate,
        status: 'active',
      },
    });

    return ok(group);
  } catch (e: any) {
    return fail(e?.message ?? 'Chit create failed', 500);
  }
}
