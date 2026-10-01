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
  isMaskedAadharNumber,
  isMaskedPan,
  maskAadharNumber,
  maskPan,
  normalizeAadharNumber,
  normalizePhone,
} from '@/lib/pii';
import { writeAudit } from '@/lib/audit';
import { calculateCreditScore } from '@/lib/creditScore';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';
import { syncGuarantorsInPlace } from '@/lib/customers/guarantors';
import { CUSTOMER_EDIT_ALLOW_LIST } from '@/lib/customers/editPolicy';

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
  'lat',
  'lng',
] as const;
// Numeric fields coerced from the request body.
const CUSTOMER_NUMERIC_FIELDS = new Set(['monthlyIncome', 'lat', 'lng']);

async function findScopedCustomer(id: string, ctx: MobileTokenClaims) {
  const where: any = {
    OR: [{ id }, { customerCode: id }],
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    deletedAt: null,
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

  // SEC-01: Strip passwordHash so it never reaches client or browser component
  const { passwordHash: _ph, ...safe } = customer;

  return ok({
    ...safe,
    creditScore,
    pan: maskPan(customer.pan),
    aadharNumber: maskAadharNumber(decryptAadharNumber(customer.aadharNumber)),
    guarantors: customer.guarantors.map((g) => ({
      ...g,
      aadharNumber: maskAadharNumber(decryptAadharNumber(g.aadharNumber)),
    })),
    kycDocuments: customer.kycDocuments.map((doc) => ({
      ...doc,
      type: doc.docType,
      url: doc.filePath,
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
    if (data.profilePhoto === undefined && body.photoUrl !== undefined) {
      data.profilePhoto = body.photoUrl;
    }
    if (data.profilePhoto === '') {
      data.profilePhoto = null;
    }
    if (data.phone !== undefined) {
      const normalizedPhone = normalizePhone(data.phone as string);
      if (normalizedPhone.length !== 10) {
        return fail('Phone number must be exactly 10 digits', 400);
      }
      data.phone = normalizedPhone;

      const duplicate = await prisma.customer.findFirst({
        where: {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          phone: normalizedPhone,
          deletedAt: null,
          id: { not: existing.id },
        },
        select: { id: true },
      });
      if (duplicate) {
        return fail('Customer with this phone already exists', 409);
      }
    }
    if (data.aadharNumber !== undefined) {
      if (isMaskedAadharNumber(String(data.aadharNumber || ''))) {
        delete data.aadharNumber; // MON-08: web prefills masked XXXX XXXX 1234
      } else {
        const normAadhaar = normalizeAadharNumber(String(data.aadharNumber || ''));
        if (normAadhaar.length !== 12) {
          return fail('Aadhaar number must be exactly 12 digits', 400);
        }
        data.aadharNumber = encryptAadharNumber(normAadhaar);
      }
    }
    if (data.pan !== undefined && isMaskedPan(data.pan as string)) {
      delete data.pan;
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
        where: { id: data.routeId, tenantId: ctx.tenantId, appType: ctx.appType },
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


    if (Array.isArray(body.kycDocs) && body.kycDocs.length > 0) {
      // MON-09: append-only — no deleteMany. Web used to send kycDocs: []
      // which wiped all documents on every edit.
      data.kycDocuments = {
        create: body.kycDocs.map((d: any) => ({
          docType: d.type || 'other',
          filePath: d.url,
          fileName: d.url.split('/').pop() || 'document',
        })),
      };
    }

    if (Array.isArray(body.securityCheques) && body.securityCheques.length > 0) {
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

    // Agents cannot edit customer details directly — must submit an approval request (matching loan edit).
    if (ctx.role === 'agent') {
      // CUST-05: same rules as the web agent edit request — only allow-listed
      // fields, only real changes (masked Aadhaar already dropped above), audit
      // row in the same transaction, approvers notified after commit.
      const changes: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (!CUSTOMER_EDIT_ALLOW_LIST.has(key)) continue;
        const current = key === 'aadharNumber'
          ? decryptAadharNumber((existing as any).aadharNumber)
          : (existing as any)[key === 'photo' || key === 'photoUrl' ? 'profilePhoto' : key];
        const next = key === 'aadharNumber' ? decryptAadharNumber(value as string) : value;
        if (String(current ?? '') !== String(next ?? '')) changes[key] = value;
      }
      if (Object.keys(changes).length === 0) {
        return fail('No changes detected. Please modify at least one field.', 400);
      }
      const reason = (body.reason as string) || 'Customer profile / GPS update requested by agent';
      const request = await prisma.$transaction(async (tx) => {
        const created = await tx.approvalRequest.create({
          data: {
            tenantId: ctx.tenantId,
            appType: ctx.appType,
            requestType: 'customer_edit',
            entityType: 'customer',
            entityId: existing.id,
            requestedById: ctx.userId,
            requestedChanges: JSON.stringify(changes),
            reason,
            status: 'pending',
          },
        });
        await tx.auditLog.create({
          data: {
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            action: 'create',
            entityType: 'approval_request',
            entityId: existing.id,
            newValue: JSON.stringify({ requestType: 'customer_edit', changes: Object.keys(changes) }),
          },
        });
        return created;
      });
      try {
        const { notifyApprovers } = await import('@/lib/notify/approvers');
        const { modulePath } = await import('@/types/modules');
        await notifyApprovers({
          tenantId: ctx.tenantId,
          branchId: (existing as any).branchId ?? null,
          requesterBranchId: ctx.branchId,
          requesterRole: ctx.role,
          appType: ctx.appType,
          type: 'customer_edit_review',
          icon: 'rate_review',
          title: 'Customer edit pending review',
          message: `Agent requested edits for customer ${(existing as any).name}.`,
          link: modulePath(ctx.appType, '/approvals'),
        });
      } catch (err) {
        console.error('[customers PATCH] approver notification failed:', err);
      }

      // SEC-01: Return only approval acknowledgement; do not echo existing customer row,
      // which contains encrypted Aadhaar ciphertext and passwordHash.
      return ok({
        pendingApproval: true,
        approvalRequestId: request.id,
        message: 'Customer edit request submitted for admin approval',
      });
    }

    if (data.lat !== undefined && data.lng !== undefined && data.lat !== null && data.lng !== null) {
      data.geocodedAt = new Date();
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Array.isArray(body.guarantors)) {
        await syncGuarantorsInPlace(tx, existing.id, body.guarantors);
      }
      return tx.customer.update({
        where: { id: existing.id },
        data,
        include: { collectionPoints: true, guarantors: true },
      });
    });

    if (data.lat != null && data.lng != null) {
      try {
        await prisma.customerGeocode.upsert({
          where: { customerId: existing.id },
          update: {
            latitude: Number(data.lat),
            longitude: Number(data.lng),
            accuracy: 'manual',
            rawAddress: (data.address as string) || existing.address || '',
            geocodedAt: new Date(),
          },
          create: {
            customerId: existing.id,
            tenantId: ctx.tenantId,
            latitude: Number(data.lat),
            longitude: Number(data.lng),
            accuracy: 'manual',
            source: 'manual',
            rawAddress: (data.address as string) || existing.address || '',
          },
        });
      } catch (err) {
        console.error('CustomerGeocode upsert failed:', err);
      }
    }

    await writeAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'customer',
      entityId: existing.id,
      oldValue: existing,
      newValue: data,
    });

    // SEC-01: Strip passwordHash so it never reaches client or browser component
    const { passwordHash: _ph, ...safeUpdated } = updated;

    return ok({
      ...safeUpdated,
      pan: maskPan(updated.pan),
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
