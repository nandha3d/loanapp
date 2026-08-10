import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import {
  MobileTokenClaims,
  requireMobileContext,
  scopedBranchWhere,
} from '@/lib/api/v1-auth';
import {
  decryptAadharNumber,
  encryptAadharNumber,
  maskAadharNumber,
} from '@/lib/pii';
import { writeAudit } from '@/lib/audit';
import { calculateCreditScore } from '@/lib/creditScore';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';

const CUSTOMER_UPDATE_FIELDS = [
  'name',
  'phone',
  'address',
  'aadharNumber',
  'kycStatus',
  'status',
  // Extended profile parity with the web edit form.
  'email',
  'pan',
  'routeId',
  'agentId',
  'occupation',
  'companyName',
  'companyType',
  'businessType',
  'gstNumber',
  'companyPan',
  'companyRegNo',
  'companyAddress',
  'companyPhone',
  'companyEmail',
  'designation',
  'preferredCollectionTime',
  'profilePhoto',
  'companyLogo',
] as const;
// Numeric fields coerced from the request body.
const CUSTOMER_NUMERIC_FIELDS = new Set(['monthlyIncome']);

async function findScopedCustomer(id: string, ctx: MobileTokenClaims) {
  const where: any = {
    OR: [{ id }, { customerCode: id }],
    tenantId: ctx.tenantId,
    appType: ctx.appType,
  };
  if (ctx.role === 'agent') {
    // Agents scope by customer-linkage only, NOT branch (a branch pin 404s their
    // own customers whose branchId is null or differs from the agent's branch).
    where.AND = [buildAgentCustomerAccessWhere({ userId: ctx.userId })];
  } else {
    // AND, not a spread: this object already matches on `OR: [{id}, {code}]`
    // and a second top-level key would be fine today, but keeping the scope in
    // AND keeps list and detail identical no matter what either grows into.
    where.AND = [scopedBranchWhere(ctx)];
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
      collectionPoints: true,
      kycSessions: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
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

  // Canonical credit score — the SAME figure the web shows (300–850 + grade),
  // from the shared lib so platforms never diverge. Returned as a structured
  // object; the mobile renders it directly (no client-side recomputation).
  const creditScore = calculateCreditScore(customer.loans);

  return ok({
    ...customer,
    creditScore,
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

  // Agents may update customers on their own routes (findScopedCustomer enforces scope).
  if (!['admin', 'superadmin', 'developer', 'agent'].includes(ctx.role)) {
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
    // Numeric coercion (Float columns).
    for (const f of CUSTOMER_NUMERIC_FIELDS) {
      if (body[f] !== undefined) {
        const n = Number(body[f]);
        data[f] = Number.isFinite(n) ? n : null;
      }
    }

    // Route drives the collecting agent: when the route is (re)assigned, derive
    // the agent from the route's primary agent and inherit the route's branch.
    // (The per-customer agent picker was removed — assignment lives in Settings.)
    if (typeof data.routeId === 'string' && data.routeId) {
      const route = await prisma.route.findFirst({
        where: { id: data.routeId, tenantId: ctx.tenantId },
        select: { assignedAgentId: true, branchId: true },
      });
      if (route) {
        data.agentId = route.assignedAgentId ?? (data.agentId as string | null) ?? null;
        if (route.branchId) data.branchId = route.branchId;
      }
    }

    if (Array.isArray(body.collectionPoints)) {
      const num = (v: unknown) =>
        v === undefined || v === null || v === '' ? null : Number(v);
      const cps = body.collectionPoints
        .filter((cp: any) => cp?.name && cp?.address)
        .map((cp: any) => ({
          name: String(cp.name),
          address: String(cp.address),
          latitude: num(cp.latitude),
          longitude: num(cp.longitude),
          isPrimary: !!cp.isPrimary,
        }));
      data.collectionPoints = {
        deleteMany: {},
        create: cps,
      };
    }

    if (Array.isArray(body.guarantors)) {
      const gs = body.guarantors
        .filter((g: any) => g?.name && g?.phone)
        .map((g: any) => ({
          name: String(g.name),
          phone: String(g.phone),
          relation: g.relation ? String(g.relation) : null,
          address: g.address ? String(g.address) : null,
          photo: g.photoUrl ?? g.photo ? String(g.photoUrl ?? g.photo) : null,
          aadharNumber: g.aadharNumber ? encryptAadharNumber(String(g.aadharNumber)) : null,
        }));
      data.guarantors = {
        deleteMany: {},
        create: gs,
      };
    }
    if (Array.isArray(body.kycDocs)) {
      data.kycDocuments = {
        deleteMany: {},
        create: body.kycDocs.map((d: any) => ({
          docType: d.type || 'other',
          filePath: d.url,
          fileName: d.url.split('/').pop() || 'document',
        })),
      };
    }

    if (Array.isArray(body.securityCheques)) {
      data.securityCheques = {
        deleteMany: {},
        create: body.securityCheques
          .filter((c: any) => c?.bankName && c?.chequeNumber)
          .map((c: any) => ({
            customerId: existing.id,
            bankName: String(c.bankName),
            chequeNumber: String(c.chequeNumber),
            amount: c.amount != null ? Number(c.amount) : null,
            imagePath: c.imageUrl || null,
          })),
      };
    }

    const updated = await prisma.customer.update({
      where: { id: existing.id },
      data,
      include: { collectionPoints: true, guarantors: true },
    });

    await writeAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'customer',
      entityId: existing.id,
      oldValue: existing,
      newValue: data,
    });

    return ok({
      ...updated,
      aadharNumber: maskAadharNumber(decryptAadharNumber(updated.aadharNumber)),
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Customer update failed', 500);
  }
}

/**
 * DELETE /api/v1/customers/[id] — soft-delete (sets deletedAt + status
 * 'inactive'), same convention every read query already filters on
 * (`deletedAt: null`). Blocked while the customer has any non-closed loan —
 * a customer with money still outstanding must be settled first, not erased.
 */
export async function DELETE(
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

  const hasOpenLoan = existing.loans.some(
    (l) => l.status !== 'closed' && l.status !== 'rejected',
  );
  if (hasOpenLoan) {
    return fail('This customer has an open loan — close or settle it before deleting.', 409);
  }

  await prisma.customer.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), status: 'inactive' },
  });

  await writeAudit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'delete',
    entityType: 'customer',
    entityId: existing.id,
    oldValue: { status: existing.status },
    newValue: { deletedAt: true, status: 'inactive' },
  });

  return ok({ deleted: true });
}
