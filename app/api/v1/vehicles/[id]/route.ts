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
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        deletedAt: null,
        customer: {
          ...scopedBranchWhere(ctx),
        },
      },
      include: {
        customer: {
          select: { id: true, name: true, customerCode: true, phone: true },
        },
        loan: {
          select: { id: true, loanCode: true, status: true, principal: true },
        },
        repoFlaggedBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!vehicle) return fail('Vehicle not found', 404);

    return ok(vehicle);
  } catch (e: any) {
    return fail(e?.message ?? 'Vehicle fetch failed', 500);
  }
}

const VEHICLE_EDIT_FIELDS = [
  'registrationNo',
  'make',
  'model',
  'color',
  'engineNo',
  'chassisNo',
  'vehicleType',
  'status',
] as const;

/** PATCH /api/v1/vehicles/[id] — edit a vehicle in scope. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  const existing = await prisma.vehicle.findFirst({
    where: {
      id,
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      deletedAt: null,
      customer: { ...scopedBranchWhere(ctx) },
    },
    select: { id: true },
  });
  if (!existing) return fail('Vehicle not found', 404);

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    for (const f of VEHICLE_EDIT_FIELDS) {
      if (body[f] !== undefined) data[f] = body[f] === '' ? null : body[f];
    }
    if (body.year !== undefined) data.year = body.year != null ? Number(body.year) : null;
    if (body.insuranceExpiry !== undefined) {
      data.insuranceExpiry = body.insuranceExpiry ? new Date(String(body.insuranceExpiry)) : null;
    }
    if (Object.keys(data).length === 0) return fail('No changes', 400);

    const updated = await prisma.vehicle.update({
      where: { id },
      data,
      include: { customer: { select: { id: true, name: true, customerCode: true } } },
    });
    return ok(updated);
  } catch (e: any) {
    return fail(e?.message ?? 'Vehicle update failed', 500);
  }
}
