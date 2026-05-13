import prisma from '@/lib/db';
import { ADMIN_API_ROLES, isApiError, requireApiContext } from '@/lib/apiAuth';
import { apiError, apiSuccess } from '@/lib/utils';

function packageData(body: any) {
  const data: any = {};
  if (body.name !== undefined) data.name = String(body.name);
  if (body.principal !== undefined) data.principal = Number(body.principal);
  if (body.deduction !== undefined) data.deduction = Number(body.deduction);
  if (body.deductionType !== undefined) data.deductionType = body.deductionType === 'percentage' ? 'percentage' : 'fixed';
  if (body.frequency !== undefined) data.frequency = String(body.frequency);
  if (body.tenure !== undefined) data.tenure = Number(body.tenure);
  if (body.perInstalment !== undefined) data.perInstalment = Number(body.perInstalment);
  if (body.penaltyRate !== undefined) data.penaltyRate = Number(body.penaltyRate);
  if (body.status !== undefined) data.status = String(body.status);
  return data;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const { id } = await params;
    const pkg = await prisma.loanPackage.findFirst({ where: { id, tenantId: context.tenantId, appType: context.appType } });
    if (!pkg) return apiError('Package not found', 404);
    return apiSuccess(pkg);
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
    const existing = await prisma.loanPackage.findFirst({ where: { id, tenantId: context.tenantId, appType: context.appType } });
    if (!existing) return apiError('Package not found', 404);

    const updated = await prisma.loanPackage.update({ where: { id }, data: packageData(await request.json()) });
    return apiSuccess(updated);
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

    const existing = await prisma.loanPackage.findFirst({ where: { id, tenantId: context.tenantId, appType: context.appType } });
    if (!existing) return apiError('Package not found', 404);
    const loanCount = await prisma.loan.count({ where: { packageId: id } });
    if (loanCount > 0) return apiError('Package is referenced by existing loans', 409);

    await prisma.loanPackage.delete({ where: { id } });
    return apiSuccess({ deleted: true });
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
