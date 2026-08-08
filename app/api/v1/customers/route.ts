import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail, parseCursorPaging } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchReachWhere } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';
import { encryptAadharNumber } from '@/lib/pii';
import { getBranding } from '@/lib/tenant';
import { generateCode } from '@/lib/utils';
import { writeAudit } from '@/lib/audit';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';
import { notifyApprovers } from '@/lib/notify/approvers';
import { modulePath } from '@/types/modules';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const routeId = searchParams.get('routeId');
  const status = searchParams.get('status');

  const pageParam = searchParams.get('page');
  const limitParam = searchParams.get('limit');

  const where: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    AND: [],
  };

  if (ctx.role === 'agent') {
    // Agents scope by customer-linkage (agentId / route), NOT branch — a branch
    // pin falsely hides their own customers whose branchId is null or differs
    // from the agent's home branch.
    where.AND.push(buildAgentCustomerAccessWhere({ userId: ctx.userId }));
  } else {
    // Reach records filed by this branch's agents too — a customer takes the
    // branch of its ROUTE, which is not always the agent's own branch.
    where.AND.push(scopedBranchReachWhere(ctx, 'agent'));
  }

  if (q) {
    where.AND.push({
      OR: [
        { name: { contains: q } },
        { phone: { contains: q } },
        { customerCode: { contains: q } },
      ],
    });
  }

  if (routeId) where.routeId = routeId;
  if (status) where.status = status;

  if (where.AND.length === 0) delete where.AND;

  try {
    if (pageParam) {
      // Offset pagination for web dashboard
      const page = Math.max(1, parseInt(pageParam) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(limitParam || '20') || 20));
      const skip = (page - 1) * limit;

      const [total, rows] = await Promise.all([
        prisma.customer.count({ where }),
        prisma.customer.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            route: { select: { id: true, name: true } },
            guarantors: true,
            collectionPoints: { select: { id: true, name: true, address: true, latitude: true, longitude: true, isPrimary: true } },
            loans: {
              select: {
                id: true,
                loanCode: true,
                principal: true,
                status: true,
                tenure: true,
                instalments: { select: { status: true, receivedAmount: true } },
                penalties: { select: { grossPenalty: true, status: true } },
              },
            },
          },
        }),
      ]);

      return ok(rows, {
        page,
        limit,
        total,
        pageSize: limit,
      });
    } else {
      // Cursor pagination for mobile
      const { cursor, limit } = parseCursorPaging(req.url, { defaultLimit: 20, maxLimit: 100 });
      const rows = await prisma.customer.findMany({
        where,
        include: {
          route: { select: { id: true, name: true } },
          _count: { select: { loans: { where: { status: 'active' } } } },
          collectionPoints: { select: { id: true, name: true, address: true, latitude: true, longitude: true, isPrimary: true } },
        },
        orderBy: { id: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]!.id : null;

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
    }
  } catch (e: any) {
    console.error('[/api/v1/customers GET]', e);
    return fail(e?.message ?? 'Customers list failed', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['agent', 'admin', 'superadmin', 'developer'].includes(ctx.role)) {
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
        // Extended profile parity with the web register form.
        email?: string;
        pan?: string;
        occupation?: string;
        monthlyIncome?: number | string;
        companyName?: string;
        companyType?: string;
        businessType?: string;
        gstNumber?: string;
        companyPan?: string;
        companyRegNo?: string;
        companyAddress?: string;
        companyPhone?: string;
        companyEmail?: string;
        companyLogo?: string;
        designation?: string;
        preferredCollectionTime?: string;
        collectionPoints?: Array<{
          name?: string;
          address?: string;
          latitude?: number | string | null;
          longitude?: number | string | null;
          isPrimary?: boolean;
        }>;
      }
    | null;
  if (!body?.name || !body?.phone) {
    return fail('name and phone are required', 400);
  }

  const normalizedPhone = body.phone.trim();
  const existingCustomer = await prisma.customer.findFirst({
    where: {
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      phone: normalizedPhone,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      customerCode: true,
    },
  });

  if (existingCustomer) {
    return NextResponse.json({
      data: { customer: existingCustomer },
      error: 'Customer already exists with this phone number',
      code: 'CUSTOMER_ALREADY_EXISTS',
    }, { status: 409 });
  }

  // Normalise collection points (mirror web: drop entries missing name/address).
  const num = (v: unknown) =>
    v === undefined || v === null || v === '' ? null : Number(v);
  const collectionPoints = (body.collectionPoints ?? [])
    .filter((cp) => cp?.name && cp?.address)
    .map((cp) => ({
      name: String(cp.name),
      address: String(cp.address),
      latitude: num(cp.latitude),
      longitude: num(cp.longitude),
      isPrimary: !!cp.isPrimary,
    }));

  // Coerce optional monthly income; treat blank/invalid as null.
  const monthlyIncome =
    body.monthlyIncome === undefined || body.monthlyIncome === null || body.monthlyIncome === ''
      ? null
      : Number(body.monthlyIncome);

  try {
    const branding = await getBranding(ctx.tenantId);

    let bypassCustomerApproval = false;
    if (['admin', 'superadmin', 'developer'].includes(ctx.role)) {
      bypassCustomerApproval = true;
    } else if (ctx.role === 'agent') {
      const agent = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { bypassCustomerApproval: true },
      });
      if (agent?.bypassCustomerApproval) {
        bypassCustomerApproval = true;
      }
    }

    // Route → agent linkage. The route's primary agent becomes the customer's
    // collecting agent (shared agents still see them via routeAgents). There is
    // no per-customer agent picker any more — agent↔route assignment lives in
    // Settings → Routes. Agents may only file customers on a route assigned to
    // them. The customer also inherits the route's branch so branch views stay
    // consistent (fixes customers/loans landing with a null branch).
    let resolvedRouteId: string | null = body.routeId ?? null;
    let resolvedAgentId: string | null = body.agentId ?? null;
    let resolvedBranchId: string | null = ctx.branchId;
    if (ctx.role === 'agent') {
      const myRoutes = await getAgentRouteIds(ctx.userId);
      if (resolvedRouteId && !myRoutes.includes(resolvedRouteId)) {
        return fail('You can only add customers to a route assigned to you.', 403);
      }
      if (!resolvedRouteId && myRoutes.length === 1) resolvedRouteId = myRoutes[0];
    }
    if (resolvedRouteId) {
      const route = await prisma.route.findFirst({
        where: { id: resolvedRouteId, tenantId: ctx.tenantId },
        select: { assignedAgentId: true, branchId: true },
      });
      if (!route) return fail('Selected route not found.', 400);
      resolvedAgentId = route.assignedAgentId ?? (ctx.role === 'agent' ? ctx.userId : null);
      resolvedBranchId = route.branchId ?? ctx.branchId;
    } else if (ctx.role === 'agent') {
      resolvedAgentId = ctx.userId;
    }

    // Retry loop to handle race conditions on customer code generation
    const MAX_RETRIES = 5;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Find the highest existing customer code number instead of using count
        // This prevents collisions when customers are deleted
        const prefix = branding.customerCodePrefix || 'CUS';
        const lastCustomer = await prisma.customer.findFirst({
          where: {
            tenantId: ctx.tenantId,
            customerCode: { startsWith: prefix },
          },
          orderBy: { customerCode: 'desc' },
          select: { customerCode: true },
        });

        let nextSeq = 1;
        if (lastCustomer?.customerCode) {
          const numPart = lastCustomer.customerCode.slice(prefix.length);
          const parsed = parseInt(numPart, 10);
          if (!isNaN(parsed)) {
            nextSeq = parsed + 1;
          }
        }

        const customerCode = generateCode(prefix, nextSeq, 4);

        const customer = await prisma.customer.create({
          data: {
            tenantId: ctx.tenantId,
            appType: ctx.appType,
            branchId: resolvedBranchId,
            customerCode,
            name: body.name,
            phone: body.phone,
            address: body.address ?? null,
            aadharNumber: encryptAadharNumber(body.aadharNumber ?? null),
            routeId: resolvedRouteId,
            agentId: resolvedAgentId,
            status: bypassCustomerApproval ? 'active' : 'pending_review',
            profilePhoto: body.photoUrl ?? null,
            // Extended profile fields (web parity)
            email: body.email ?? null,
            pan: body.pan ?? null,
            occupation: body.occupation ?? null,
            monthlyIncome: monthlyIncome != null && !Number.isNaN(monthlyIncome) ? monthlyIncome : null,
            companyName: body.companyName ?? null,
            companyType: body.companyType ?? null,
            businessType: body.businessType ?? null,
            gstNumber: body.gstNumber ?? null,
            companyPan: body.companyPan ?? null,
            companyRegNo: body.companyRegNo ?? null,
            companyAddress: body.companyAddress ?? null,
            companyPhone: body.companyPhone ?? null,
            companyEmail: body.companyEmail ?? null,
            companyLogo: body.companyLogo ?? null,
            designation: body.designation ?? null,
            preferredCollectionTime: body.preferredCollectionTime ?? null,
            kycDocuments: body.kycDocs && body.kycDocs.length > 0
              ? {
                  create: body.kycDocs.map((d) => ({
                    docType: d.type,
                    filePath: d.url,
                    fileName: d.url.split('/').pop() || 'document',
                  })),
                }
              : undefined,
            collectionPoints: collectionPoints.length > 0
              ? { create: collectionPoints }
              : undefined,
          },
          include: {
            route: { select: { id: true, name: true } },
            kycDocuments: true,
            collectionPoints: true,
          },
        });

        await writeAudit({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: 'create',
          entityType: 'customer',
          entityId: customer.id,
          newValue: { customerCode, name: body.name },
        });

        if (!bypassCustomerApproval) {
          await notifyApprovers({
            tenantId: ctx.tenantId,
            branchId: resolvedBranchId,
            // The customer takes its ROUTE's branch, which may not be the filing
            // agent's — their admin must still be told.
            requesterBranchId: ctx.branchId,
            appType: ctx.appType,
            type: 'approval_pending',
            icon: 'person_add',
            title: 'Customer awaiting approval',
            message: `${body.name} (${customerCode}) was submitted and needs review.`,
            link: modulePath(ctx.appType, '/approvals'),
          });
        }

        return ok(customer);
      } catch (retryErr: any) {
        // P2002 = Prisma unique constraint violation — retry with next sequence
        const isPrismaUniqueError =
          retryErr?.code === 'P2002' ||
          retryErr?.message?.includes('Unique constraint');
        if (isPrismaUniqueError && attempt < MAX_RETRIES - 1) {
          continue;
        }
        throw retryErr;
      }
    }

    return fail('Customer create failed after retries', 500);
  } catch (e: any) {
    return fail(e?.message ?? 'Customer create failed', 500);
  }
}
