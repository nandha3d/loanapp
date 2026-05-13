import prisma from '@/lib/db';
import { ADMIN_API_ROLES, isApiError, requireApiContext } from '@/lib/apiAuth';
import { apiError, apiSuccess } from '@/lib/utils';

const CUSTOMER_EDIT_ALLOW_LIST = new Set(['name', 'phone', 'address', 'aadharNumber', 'kycStatus', 'photo']);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const { id } = await params;
    const body = await request.json();
    const action = body.action === 'approve' ? 'approve' : body.action === 'reject' ? 'reject' : null;
    if (!action) return apiError('Invalid action', 400);

    const approval = await prisma.approvalRequest.findFirst({
      where: { id, tenantId: context.tenantId, appType: context.appType },
    });
    if (!approval || approval.status !== 'pending') return apiError('Request not found or already processed', 404);

    if (action === 'approve' && approval.requestType === 'customer_edit' && approval.entityType === 'customer') {
      const customer = await prisma.customer.findFirst({
        where: { id: approval.entityId, tenantId: context.tenantId, appType: context.appType },
      });
      if (!customer) return apiError('Target customer not found', 404);

      const requested = JSON.parse(approval.requestedChanges);
      const safeChanges: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(requested)) {
        if (CUSTOMER_EDIT_ALLOW_LIST.has(key)) safeChanges[key] = value;
      }
      if (Object.keys(safeChanges).length > 0) {
        await prisma.customer.update({ where: { id: approval.entityId }, data: safeChanges });
      }
    }

    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewedById: context.userId,
        reviewedAt: new Date(),
        reviewNotes: body.notes || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        userId: context.userId,
        action,
        entityType: approval.entityType,
        entityId: approval.entityId,
        newValue: JSON.stringify({ approvalId: id, action, notes: body.notes || null }),
      },
    });

    return apiSuccess(updated);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
