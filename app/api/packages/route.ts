import prisma from '@/lib/db';
import { ADMIN_API_ROLES, isApiError, requireApiContext } from '@/lib/apiAuth';
import { apiCreated, apiError, apiSuccess } from '@/lib/utils';

function computeDeduction(principal: number, deduction: number, deductionType: string) {
  return deductionType === 'percentage' ? Math.round((principal * deduction) / 100) : deduction;
}

export async function GET() {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;

    const packages = await prisma.loanPackage.findMany({
      where: { tenantId: context.tenantId, appType: context.appType, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess(packages);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const body = await request.json();

    const principal = Number(body.principal);
    const deductionType = body.deductionType === 'percentage' ? 'percentage' : 'fixed';
    const deduction = computeDeduction(principal, Number(body.deduction), deductionType);
    const tenure = Number(body.tenure);
    if (!body.name?.trim() || !principal || !tenure) return apiError('Name, principal, and tenure are required', 400);

    const pkg = await prisma.loanPackage.create({
      data: {
        tenantId: context.tenantId,
        name: body.name.trim(),
        principal,
        deduction,
        deductionType,
        frequency: body.frequency || 'daily',
        tenure,
        perInstalment: Math.round(principal / tenure),
        penaltyRate: Number(body.penaltyRate || 0),
        appType: context.appType,
        status: 'active',
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'create',
        entityType: 'loan_package',
        entityId: pkg.id,
        newValue: JSON.stringify(pkg),
      },
    });

    return apiCreated(pkg);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
