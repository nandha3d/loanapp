import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

// Gold/Silver master data — the no-hardcode source for pledge dropdowns
// (ornament types, specifications, bank names). Read by web + mobile forms.

const ADMIN_ROLES = new Set(['admin', 'superadmin', 'developer']);
type Kind = 'type' | 'spec' | 'bank';

function isKind(v: unknown): v is Kind {
  return v === 'type' || v === 'spec' || v === 'bank';
}

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const { tenantId } = auth.context;

  const metal = new URL(req.url).searchParams.get('metal') || undefined;

  const [ornamentTypes, ornamentSpecs, bankNames] = await Promise.all([
    prisma.ornamentType.findMany({
      where: { tenantId, isActive: true, ...(metal ? { metal } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.ornamentSpecification.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.bankName.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ]);

  return ok({ ornamentTypes, ornamentSpecs, bankNames });
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const { tenantId, role } = auth.context;
  if (!ADMIN_ROLES.has(role)) return fail('Forbidden', 403);

  const body = await req.json().catch(() => null);
  if (!body || !isKind(body.kind)) return fail('kind must be type|spec|bank', 400);
  const name = String(body.name || '').trim();
  if (!name) return fail('name is required', 400);
  const sortOrder = Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 0;

  try {
    if (body.kind === 'type') {
      const metal = body.metal === 'silver' ? 'silver' : 'gold';
      const row = await prisma.ornamentType.create({ data: { tenantId, name, metal, sortOrder } });
      return ok(row);
    }
    if (body.kind === 'spec') {
      const purityKarat = body.purityKarat ? String(body.purityKarat) : null;
      const row = await prisma.ornamentSpecification.create({ data: { tenantId, name, purityKarat, sortOrder } });
      return ok(row);
    }
    const row = await prisma.bankName.create({ data: { tenantId, name, sortOrder } });
    return ok(row);
  } catch (e: any) {
    if (e?.code === 'P2002') return fail('That name already exists', 409);
    return fail('Failed to create', 500);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const { tenantId, role } = auth.context;
  if (!ADMIN_ROLES.has(role)) return fail('Forbidden', 403);

  const body = await req.json().catch(() => null);
  if (!body || !isKind(body.kind) || !body.id) return fail('kind and id required', 400);
  const id = String(body.id);

  const data: Record<string, unknown> = {};
  if (typeof body.name === 'string') data.name = body.name.trim();
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
  if (Number.isFinite(body.sortOrder)) data.sortOrder = Number(body.sortOrder);
  if (body.kind === 'type' && body.metal) data.metal = body.metal === 'silver' ? 'silver' : 'gold';
  if (body.kind === 'spec' && body.purityKarat !== undefined) {
    data.purityKarat = body.purityKarat ? String(body.purityKarat) : null;
  }

  try {
    // Scope the update to the tenant so one tenant can't edit another's row.
    if (body.kind === 'type') {
      const r = await prisma.ornamentType.updateMany({ where: { id, tenantId }, data });
      return r.count ? ok({ id }) : fail('Not found', 404);
    }
    if (body.kind === 'spec') {
      const r = await prisma.ornamentSpecification.updateMany({ where: { id, tenantId }, data });
      return r.count ? ok({ id }) : fail('Not found', 404);
    }
    const r = await prisma.bankName.updateMany({ where: { id, tenantId }, data });
    return r.count ? ok({ id }) : fail('Not found', 404);
  } catch {
    return fail('Failed to update', 500);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const { tenantId, role } = auth.context;
  if (!ADMIN_ROLES.has(role)) return fail('Forbidden', 403);

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get('kind');
  const id = searchParams.get('id');
  if (!isKind(kind) || !id) return fail('kind and id required', 400);

  // Soft-delete (deactivate) so historical pledges keep their dropdown value.
  try {
    if (kind === 'type') {
      const r = await prisma.ornamentType.updateMany({ where: { id, tenantId }, data: { isActive: false } });
      return r.count ? ok({ id }) : fail('Not found', 404);
    }
    if (kind === 'spec') {
      const r = await prisma.ornamentSpecification.updateMany({ where: { id, tenantId }, data: { isActive: false } });
      return r.count ? ok({ id }) : fail('Not found', 404);
    }
    const r = await prisma.bankName.updateMany({ where: { id, tenantId }, data: { isActive: false } });
    return r.count ? ok({ id }) : fail('Not found', 404);
  } catch {
    return fail('Failed to delete', 500);
  }
}
