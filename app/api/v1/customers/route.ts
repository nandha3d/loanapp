import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';
import { encryptAadharNumber } from '@/lib/pii';
import { getBranding } from '@/lib/tenant';
import { generateCode } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');

  const where: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    ...scopedBranchWhere(ctx),
  };

  if (ctx.role === 'agent') {
    const routeIds = await getAgentRouteIds(ctx.userId);
    if (routeIds.length === 0) return ok([]);
    where.routeId = { in: routeIds };
  }

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { phone: { contains: q } },
      { customerCode: { contains: q } },
    ];
  }

  try {
    const customers = await prisma.customer.findMany({
      where,
      include: {
        route: { select: { id: true, name: true } },
        loans: {
          where: { status: 'active' },
          select: { id: true, principal: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return ok(customers);
  } catch (e: any) {
    return fail(e?.message ?? 'Customers list failed', 500);
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
        phone?: string;
        address?: string;
        aadharNumber?: string;
        routeId?: string;
        agentId?: string;
        photoUrl?: string;
        kycDocs?: Array<{ type: string; url: string }>;
      }
    | null;
  if (!body?.name || !body?.phone) {
    return fail('name and phone are required', 400);
  }

  try {
    const branding = await getBranding(ctx.tenantId);
    const count = await prisma.customer.count({
      where: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        ...scopedBranchWhere(ctx),
      },
    });
    const customerCode = generateCode(branding.customerCodePrefix, count + 1, 4);

    const customer = await prisma.customer.create({
      data: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        branchId: ctx.branchId,
        customerCode,
        name: body.name,
        phone: body.phone,
        address: body.address ?? null,
        aadharNumber: encryptAadharNumber(body.aadharNumber ?? null),
        routeId: body.routeId ?? null,
        agentId: body.agentId ?? null,
        status: 'pending_review',
        photoUrl: body.photoUrl ?? null,
        kycDocuments: body.kycDocs && body.kycDocs.length > 0
          ? {
              create: body.kycDocs.map((d) => ({
                type: d.type,
                url: d.url,
                tenantId: ctx.tenantId,
              })),
            }
          : undefined,
      },
      include: { route: { select: { id: true, name: true } }, kycDocuments: true },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'create',
        entityType: 'customer',
        entityId: customer.id,
        newValue: JSON.stringify({ customerCode, name: body.name }),
      },
    });

    return ok(customer);
  } catch (e: any) {
    return fail(e?.message ?? 'Customer create failed', 500);
  }
}
