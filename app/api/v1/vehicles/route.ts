import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail, parseCursorPaging } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const { cursor, limit } = parseCursorPaging(req.url, { defaultLimit: 20, maxLimit: 100 });

  const where: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    deletedAt: null,
    // Agents scope by customer-linkage (agentId / route), NOT branch — same fix
    // applied to loans/customers so a branch pin doesn't hide their own records.
    customer:
      ctx.role === 'agent'
        ? buildAgentCustomerAccessWhere({ userId: ctx.userId })
        : { ...scopedBranchWhere(ctx) },
  };

  if (q) {
    where.OR = [
      { registrationNo: { contains: q } },
      { make: { contains: q } },
      { model: { contains: q } },
      { customer: { name: { contains: q } } },
    ];
  }

  try {
    const rows = await prisma.vehicle.findMany({
      where,
      select: {
        id: true,
        registrationNo: true,
        make: true,
        model: true,
        year: true,
        color: true,
        vehicleType: true,
        repoFlag: true,
        insuranceExpiry: true,
        customer: {
          select: { id: true, name: true, customerCode: true },
        },
        loan: {
          select: { id: true, loanCode: true },
        },
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1]!.id : null;

    return ok(data, { nextCursor, limit });
  } catch (e: any) {
    return fail(e?.message ?? 'Vehicles list failed', 500);
  }
}

/** POST /api/v1/vehicles — create a vehicle for a customer in scope. */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const customerId = String(body.customerId || '');
    const registrationNo = String(body.registrationNo || '').trim();
    const make = String(body.make || '').trim();
    const model = String(body.model || '').trim();
    if (!customerId || !registrationNo || !make || !model) {
      return fail('customerId, registrationNo, make, model are required', 400);
    }

    // Customer must belong to the caller's scope — agents by customer-linkage,
    // others by branch.
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        ...(ctx.role === 'agent'
          ? buildAgentCustomerAccessWhere({ userId: ctx.userId })
          : scopedBranchWhere(ctx)),
      },
      select: { id: true },
    });
    if (!customer) return fail('Customer not found', 404);

    // An agent's vehicle goes to admin approval unless they hold the bypass.
    let status = 'active';
    if (ctx.role === 'agent') {
      const agent = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { bypassVehicleApproval: true },
      });
      status = agent?.bypassVehicleApproval ? 'active' : 'pending_review';
    }

    const dup = await prisma.vehicle.findFirst({
      where: { tenantId: ctx.tenantId, appType: ctx.appType, registrationNo, deletedAt: null },
      select: { id: true },
    });
    if (dup) return fail(`Registration "${registrationNo}" already exists`, 409);

    const vehicle = await prisma.vehicle.create({
      data: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        customerId,
        registrationNo,
        make,
        model,
        year: body.year != null ? Number(body.year) : null,
        color: body.color ? String(body.color) : null,
        engineNo: body.engineNo ? String(body.engineNo) : null,
        chassisNo: body.chassisNo ? String(body.chassisNo) : null,
        vehicleType: body.vehicleType ? String(body.vehicleType) : 'two_wheeler',
        insuranceExpiry: body.insuranceExpiry ? new Date(String(body.insuranceExpiry)) : null,
        status,
      },
      include: { customer: { select: { id: true, name: true, customerCode: true, branchId: true } } },
    });

    if (status === 'pending_review') {
      const { notifyApprovers } = await import('@/lib/notify/approvers');
      const { modulePath } = await import('@/types/modules');
      await notifyApprovers({
        tenantId: ctx.tenantId,
        branchId: vehicle.customer?.branchId ?? ctx.branchId,
        requesterBranchId: ctx.branchId,
        appType: ctx.appType,
        type: 'approval_pending',
        icon: 'directions_car',
        title: 'Vehicle awaiting approval',
        message: `Vehicle ${registrationNo} (${vehicle.customer?.name ?? 'customer'}) was submitted and needs review.`,
        link: modulePath(ctx.appType, '/approvals'),
      });
    }

    return ok(vehicle);
  } catch (e: any) {
    return fail(e?.message ?? 'Vehicle create failed', 500);
  }
}
