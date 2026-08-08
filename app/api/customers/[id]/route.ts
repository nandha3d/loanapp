import prisma from '@/lib/db';
import { ADMIN_API_ROLES, AUTHENTICATED_API_ROLES, isApiError, requireApiContext, scopedBranchReachWhere } from '@/lib/apiAuth';
import { apiError, apiSuccess } from '@/lib/utils';
import { decryptAadharNumber, encryptAadharNumber, maskAadharNumber } from '@/lib/pii';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';

const CUSTOMER_UPDATE_FIELDS = ['name', 'phone', 'address', 'aadharNumber', 'kycStatus'] as const;

async function findScopedCustomer(id: string, context: any) {
  const where: any = {
    OR: [{ id }, { customerCode: id }],
    tenantId: context.tenantId,
    appType: context.appType,
  };

  // AND, not a spread: both scope clauses are themselves ORs and would
  // otherwise overwrite the id/customerCode OR above.
  if (context.role === 'agent') {
    where.AND = [buildAgentCustomerAccessWhere({ userId: context.userId })];
  } else {
    where.AND = [scopedBranchReachWhere(context, 'agent')];
  }

  return prisma.customer.findFirst({
    where,
    include: {
      route: true,
      agent: { select: { id: true, name: true, phone: true } },
      loans: { orderBy: { createdAt: 'desc' }, include: { instalments: true, penalties: true, collaterals: true } },
      kycDocuments: true,
      securityCheques: true,
      guarantors: true,
    },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireApiContext(AUTHENTICATED_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const { id } = await params;

    const customer = await findScopedCustomer(id, context);
    if (!customer) return apiError('Customer not found', 404);
    return apiSuccess({
      ...customer,
      aadharNumber: maskAadharNumber(decryptAadharNumber(customer.aadharNumber)),
      guarantors: customer.guarantors.map((guarantor) => ({
        ...guarantor,
        aadharNumber: maskAadharNumber(decryptAadharNumber(guarantor.aadharNumber)),
      })),
    });
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const { id } = await params;
    const existing = await findScopedCustomer(id, context);
    if (!existing) return apiError('Customer not found', 404);

    const body = await request.json();
    const data: any = {};
    for (const field of CUSTOMER_UPDATE_FIELDS) {
      if (body[field] !== undefined) data[field] = body[field];
    }
    if (data.aadharNumber !== undefined) {
      data.aadharNumber = encryptAadharNumber(String(data.aadharNumber || ''));
    }

    const updated = await prisma.customer.update({ where: { id: existing.id }, data });
    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'update',
        entityType: 'customer',
        entityId: existing.id,
        oldValue: JSON.stringify(existing),
        newValue: JSON.stringify(data),
      },
    });

    return apiSuccess({
      ...updated,
      aadharNumber: maskAadharNumber(decryptAadharNumber(updated.aadharNumber)),
    });
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const { id } = await params;
    const existing = await findScopedCustomer(id, context);
    if (!existing) return apiError('Customer not found', 404);

    const updated = await prisma.customer.update({ where: { id: existing.id }, data: { status: 'inactive' } });
    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'delete',
        entityType: 'customer',
        entityId: existing.id,
        newValue: JSON.stringify({ status: 'inactive' }),
      },
    });

    return apiSuccess(updated);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
