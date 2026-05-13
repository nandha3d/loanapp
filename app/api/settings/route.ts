import prisma from '@/lib/db';
import { ADMIN_API_ROLES, isApiError, requireApiContext } from '@/lib/apiAuth';
import { setSetting } from '@/lib/tenant';
import { apiError, apiSuccess } from '@/lib/utils';

export async function GET() {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;

    const settings = await prisma.appSetting.findMany({
      where: { tenantId: context.tenantId },
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
    return apiSuccess(settings);
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
    const saved: Record<string, string> = {};

    for (const [key, value] of Object.entries(body)) {
      await setSetting(context.tenantId, key, String(value), 'api');
      saved[key] = String(value);
    }

    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'update',
        entityType: 'settings',
        newValue: JSON.stringify(saved),
      },
    });

    return apiSuccess(saved);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
