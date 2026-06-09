import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { AUTHENTICATED_API_ROLES, isApiError, requireApiContext, scopedBranchWhere } from '@/lib/apiAuth';
import { getAgentRouteIds } from '@/lib/access';
import { apiCreated, apiError, apiSuccess } from '@/lib/utils';
import { getClientIp, checkRateLimit, routeKey } from '@/lib/rateLimit';
import {
  isGpsTrackingEnabled,
  normalizeGpsBody,
  recordCollectionLocationPing,
  verifyAndPersistCollectionLocation,
} from '@/lib/gps/locationVerifier';
import { submitCollectionEntry } from '@/lib/collectionWrite';

function parseDay(value: string | null) {
  const day = value ? new Date(value) : new Date();
  day.setHours(0, 0, 0, 0);
  return day;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '';
}

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

export async function GET(request: Request) {
  try {
    const authResult = await requireApiContext(AUTHENTICATED_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const { searchParams } = new URL(request.url);

    const date = parseDay(searchParams.get('date'));
    const agentId = searchParams.get('agentId');
    const routeId = searchParams.get('routeId');

    const where: Prisma.DailyCollectionWhereInput = {
      tenantId: context.tenantId,
      appType: context.appType,
      date,
      ...scopedBranchWhere(context),
    };
    if (agentId) where.agentId = agentId;
    if (routeId) where.routeId = routeId;

    if (context.role === 'agent') {
      where.agentId = context.userId;
      const routeIds = await getAgentRouteIds(context.userId);
      if (routeIds.length === 0) return apiSuccess([]);
      if (routeId && !routeIds.includes(routeId)) return apiError('Forbidden', 403);
      if (!routeId) where.routeId = { in: routeIds };
    }

    const collections = await prisma.dailyCollection.findMany({
      where,
      include: {
        agent: { select: { id: true, name: true, phone: true } },
        route: true,
        entries: {
          include: {
            customer: { select: { id: true, customerCode: true, name: true, phone: true } },
            loan: { select: { id: true, loanCode: true } },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return apiSuccess(collections);
  } catch (error: unknown) {
    return apiError(errorMessage(error), 500);
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(routeKey('collection:post', ip), { limit: 60, windowMs: 60 * 1000 });
    if (!rateLimit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000));
      return Response.json(
        { success: false, error: 'Too many collection requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      );
    }

    const authResult = await requireApiContext(AUTHENTICATED_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const body = await request.json();

    const gpsTrackingEnabled = await isGpsTrackingEnabled(context.tenantId);
    const gpsCapture = normalizeGpsBody(body, gpsTrackingEnabled);
    const { entry, instalment } = await submitCollectionEntry({
      tenantId: context.tenantId,
      appType: context.appType,
      userId: context.userId,
      branchId: context.branchId,
      role: context.role,
    }, {
      instalmentId: String(body.instalmentId || ''),
      receivedAmount: Number(body.receivedAmount),
      paymentMode: String(body.paymentMode || 'cash'),
      remarks: body.remarks ? String(body.remarks) : null,
      idempotencyKey: body.idempotencyKey as string | undefined,
      gps: gpsCapture,
    }, {
      appendDirectPaymentRemark: true,
      enforceBranchScope: true,
      writeAudit: true,
    });

    if (gpsTrackingEnabled) {
      try {
        await Promise.all([
          verifyAndPersistCollectionLocation({
            entryId: entry.id,
            tenantId: context.tenantId,
            customerId: instalment.loan.customerId,
            latitude: gpsCapture.latitude,
            longitude: gpsCapture.longitude,
          }),
          recordCollectionLocationPing({
            tenantId: context.tenantId,
            agentId: context.userId,
            branchId: instalment.loan.branchId ?? null,
            capture: gpsCapture,
          }),
        ]);
      } catch (error) {
        console.error('GPS verification failed:', error);
      }
    }

    return apiCreated(entry);
  } catch (error: unknown) {
    const msg = errorMessage(error);
    if (msg === 'invalid_amount') return apiError('Invalid amount', 400);
    if (msg === 'not_found') return apiError('Instalment not found', 404);
    if (msg === 'forbidden') return apiError('Forbidden', 403);
    if (msg.startsWith('already_paid')) return apiError(msg, 409);
    if (errorCode(error) === 'P2002' || /already recorded|duplicate|unique|fully collected/i.test(msg)) {
      return apiError('Already recorded: duplicate collection submission', 409);
    }
    return apiError(msg, 500);
  }
}
