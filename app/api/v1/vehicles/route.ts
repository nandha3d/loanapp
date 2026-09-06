import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail, parseCursorPaging } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { VEHICLE_TYPES } from '@/lib/autofinance/vehicleTypes';
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
    // AUTO-554 — a broken body is invalid input, not a server fault.
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return fail('Invalid JSON body', 400);
    const customerId = String(body.customerId || '');
    // AF-4 — normalise exactly as the origination route does, or the same plate
    // is stored two ways ("  tn39ab1234 " and "TN39AB1234") and never matches.
    const registrationNo = String(body.registrationNo || '').trim().toUpperCase();
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

    // AUTO-036 — every report groups on vehicleType, so an unknown value must be
    // refused rather than stored raw.
    const vehicleType = body.vehicleType ? String(body.vehicleType).trim().toLowerCase() : 'two_wheeler';
    if (!(VEHICLE_TYPES as readonly string[]).includes(vehicleType)) {
      return fail(`Invalid vehicleType "${vehicleType}" — expected one of ${VEHICLE_TYPES.join(', ')}`, 400);
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
        vehicleType,
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
        requesterRole: ctx.role,
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
