import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

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
        ...scopedBranchWhere(ctx),
        deletedAt: null,
      },
      include: {
        members: {
          include: {
            customer: { select: { id: true, customerCode: true, name: true } },
          },
          orderBy: { memberNumber: 'asc' },
        },
        auctions: { orderBy: { periodNumber: 'asc' } },
      },
    });
    if (!group) return fail('Chit group not found', 404);
    return ok(group);
  } catch (e: any) {
    return fail(e?.message ?? 'Chit detail failed', 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

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
      }
    | null;

  try {
    const existing = await prisma.chitGroup.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
        ...scopedBranchWhere(ctx),
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!existing) return fail('Chit group not found', 404);

    const data: Record<string, unknown> = {};
    if (body?.name != null) {
      const name = body.name.trim();
      if (!name) return fail('name is required', 400);
      data.name = name;
    }
    if (body?.chitValue != null) {
      const value = Number(body.chitValue);
      if (!Number.isFinite(value) || value <= 0) return fail('chitValue must be greater than zero', 400);
      data.chitValue = value;
    }
    if (body?.monthlyContrib != null) {
      const value = Number(body.monthlyContrib);
      if (!Number.isFinite(value) || value <= 0) return fail('monthlyContrib must be greater than zero', 400);
      data.monthlyContrib = value;
    }
    if (body?.totalMembers != null) {
      const value = Number(body.totalMembers);
      if (!Number.isInteger(value) || value <= 0) return fail('totalMembers must be a positive integer', 400);
      data.totalMembers = value;
    }
    if (body?.durationMonths != null) {
      const value = Number(body.durationMonths);
      if (!Number.isInteger(value) || value <= 0) return fail('durationMonths must be a positive integer', 400);
      data.durationMonths = value;
    }
    if (body?.commissionPct != null) {
      const value = Number(body.commissionPct);
      if (!Number.isFinite(value) || value < 0) return fail('commissionPct must be zero or greater', 400);
      data.commissionPct = value;
    }
    if (body?.startDate != null) {
      const startDate = new Date(body.startDate);
      if (Number.isNaN(startDate.getTime())) return fail('startDate is invalid', 400);
      data.startDate = startDate;
    }

    const updated = await prisma.chitGroup.update({
      where: { id },
      data,
    });
    return ok(updated);
  } catch (e: any) {
    return fail(e?.message ?? 'Chit update failed', 500);
  }
}
