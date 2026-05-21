import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import {
  MobileTokenClaims,
  requireMobileContext,
  scopedBranchWhere,
} from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';
import {
  decryptAadharNumber,
  encryptAadharNumber,
  maskAadharNumber,
} from '@/lib/pii';

const CUSTOMER_UPDATE_FIELDS = [
  'name',
  'phone',
  'address',
  'aadharNumber',
  'kycStatus',
  'status',
] as const;

async function findScopedCustomer(id: string, ctx: MobileTokenClaims) {
  const where: any = {
    OR: [{ id }, { customerCode: id }],
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    ...scopedBranchWhere(ctx),
  };
  if (ctx.role === 'agent') {
    const routeIds = await getAgentRouteIds(ctx.userId);
    if (routeIds.length === 0) return null;
    where.routeId = { in: routeIds };
  }
  return prisma.customer.findFirst({
    where,
    include: {
      route: true,
      agent: { select: { id: true, name: true, phone: true } },
      loans: {
        orderBy: { createdAt: 'desc' },
        include: { instalments: true, penalties: true, collaterals: true },
      },
      kycDocuments: true,
      securityCheques: true,
      guarantors: true,
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const { id } = await params;
  const customer = await findScopedCustomer(id, ctx);
  if (!customer) return fail('Customer not found', 404);

  return ok({
    ...customer,
    aadharNumber: maskAadharNumber(decryptAadharNumber(customer.aadharNumber)),
    guarantors: customer.guarantors.map((g) => ({
      ...g,
      aadharNumber: maskAadharNumber(decryptAadharNumber(g.aadharNumber)),
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const { id } = await params;
  const existing = await findScopedCustomer(id, ctx);
  if (!existing) return fail('Customer not found', 404);

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    for (const field of CUSTOMER_UPDATE_FIELDS) {
      if (body[field] !== undefined) data[field] = body[field];
    }
    if (data.aadharNumber !== undefined) {
      data.aadharNumber = encryptAadharNumber(String(data.aadharNumber || ''));
    }

    const updated = await prisma.customer.update({
      where: { id: existing.id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'update',
        entityType: 'customer',
        entityId: existing.id,
        oldValue: JSON.stringify(existing),
        newValue: JSON.stringify(data),
      },
    });

    return ok({
      ...updated,
      aadharNumber: maskAadharNumber(decryptAadharNumber(updated.aadharNumber)),
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Customer update failed', 500);
  }
}
