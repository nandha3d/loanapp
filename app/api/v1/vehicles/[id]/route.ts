import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { VEHICLE_TYPES } from '@/lib/autofinance/vehicleTypes';
import { writeAudit } from '@/lib/audit';

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
    select: { id: true, status: true },
  });
  if (!existing) return fail('Vehicle not found', 404);

  try {
    // A broken body is invalid input, not a server fault.
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return fail('Invalid JSON body', 400);

    // ROLE-4 / AUTO-056 — approval is an admin act. An agent must never move
    // their own submission out of pending_review; the handler refuses it rather
    // than trusting the UI to hide the control.
    if (body.status !== undefined && body.status !== existing.status) {
      if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
        return fail('Only an admin may change a vehicle status', 403);
      }
    }

    const data: Record<string, unknown> = {};
    for (const f of VEHICLE_EDIT_FIELDS) {
      if (body[f] !== undefined) data[f] = body[f] === '' ? null : body[f];
    }
    // AF-4 — the same plate must never be stored two ways.
    if (typeof data.registrationNo === 'string') {
      data.registrationNo = data.registrationNo.trim().toUpperCase();
    }
    if (typeof data.vehicleType === 'string') {
      const vt = data.vehicleType.trim().toLowerCase();
      if (!(VEHICLE_TYPES as readonly string[]).includes(vt)) {
        return fail(`Invalid vehicleType "${vt}" — expected one of ${VEHICLE_TYPES.join(', ')}`, 400);
      }
      data.vehicleType = vt;
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
    // AUTO-054 — a status transition (the approval) is audited with its actor.
    if (body.status !== undefined && body.status !== existing.status) {
      await writeAudit({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'vehicle_status_change',
        entityType: 'vehicle',
        entityId: id,
        oldValue: { status: existing.status },
        newValue: { status: body.status },
      });
    }
    return ok(updated);
  } catch (e: any) {
    return fail(e?.message ?? 'Vehicle update failed', 500);
  }
}
