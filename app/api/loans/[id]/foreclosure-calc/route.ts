import prisma from '@/lib/db';
import { ADMIN_API_ROLES, isApiError, requireApiContext } from '@/lib/apiAuth';
import { calculateForeclosure } from '@/lib/foreclosure';
import { apiError, apiSuccess } from '@/lib/utils';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;

    const { tenantId } = authResult.context;
    const { id } = await params;

    const subscription = await prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { foreclosureEnabled: true },
    });

    if (!subscription?.foreclosureEnabled) {
      return apiError('Foreclosure add-on is not active under your plan subscription.', 403);
    }

    const { searchParams } = new URL(req.url);
    const discount = Math.max(0, Number(searchParams.get('discount') || '0'));
    const calculation = await calculateForeclosure(id, tenantId, Number.isFinite(discount) ? discount : 0);

    return apiSuccess(calculation);
  } catch (error: any) {
    const message = error.message || 'Internal server error';
    return apiError(message, message === 'Loan not found' ? 404 : 500);
  }
}
