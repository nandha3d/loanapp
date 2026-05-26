import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail, parseCursorPaging } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';
import { encryptAadharNumber } from '@/lib/pii';
import { getBranding } from '@/lib/tenant';
import { generateCode } from '@/lib/utils';
import { writeAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  // PAGE-01: cursor pagination (default 20, max 100).
  const { cursor, limit } = parseCursorPaging(req.url, { defaultLimit: 20, maxLimit: 100 });

  const where: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    ...scopedBranchWhere(ctx),
  };

  if (ctx.role === 'agent') {
    const routeIds = await getAgentRouteIds(ctx.userId);
    if (routeIds.length === 0) return ok([], { nextCursor: null, limit });
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
    // PERF-02: drop nested loans array (N+1). Use _count for active loan
    // count; aggregate outstanding principal in one groupBy. Client fetches
    // loan detail on demand via /api/v1/customers/:id/loans.
    const rows = await prisma.customer.findMany({
      where,
      include: {
        route: { select: { id: true, name: true } },
        _count: { select: { loans: { where: { status: 'active' } } } },
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1]!.id : null;

    // One groupBy gets outstanding principal per visible customer.
    const customerIds = data.map((c) => c.id);
    const totals = customerIds.length
      ? await prisma.loan.groupBy({
          by: ['customerId'],
          where: { customerId: { in: customerIds }, status: 'active' },
          _sum: { principal: true },
        })
      : [];
    const totalMap = new Map(totals.map((t) => [t.customerId, Number(t._sum.principal ?? 0)]));
    const enriched = data.map((c) => ({
      ...c,
      activeLoanCount: c._count.loans,
      activeLoanPrincipal: totalMap.get(c.id) ?? 0,
    }));
    return ok(enriched, { nextCursor, limit });
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
        profilePhoto: body.photoUrl ?? null,
        kycDocuments: body.kycDocs && body.kycDocs.length > 0
          ? {
              create: body.kycDocs.map((d) => ({
                docType: d.type,
                filePath: d.url,
                fileName: d.url.split('/').pop() || 'document',
              })),
            }
          : undefined,
      },
      include: { route: { select: { id: true, name: true } }, kycDocuments: true },
    });

    await writeAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'create',
      entityType: 'customer',
      entityId: customer.id,
      newValue: { customerCode, name: body.name },
    });

    return ok(customer);
  } catch (e: any) {
    return fail(e?.message ?? 'Customer create failed', 500);
  }
}
