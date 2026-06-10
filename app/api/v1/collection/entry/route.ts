import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import {
  isGpsTrackingEnabled,
  normalizeGpsBody,
  recordCollectionLocationPing,
  verifyAndPersistCollectionLocation,
} from '@/lib/gps/locationVerifier';
import { submitCollectionEntry } from '@/lib/collectionWrite';
import { CollectionEntrySchema } from '@/lib/schemas/collectionEntry';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '';
}

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

/**
 * Mobile collection submit. Body: `{instalmentId, receivedAmount, paymentMode,
 * remarks?, collectionDate?, idempotencyKey?}`. The route resolves mobile JWT
 * identity and v1 envelope shape; shared collection logic owns the write.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const rawBody = await req.json().catch(() => null);
    const parsed = CollectionEntrySchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
    }
    const body = parsed.data;
    const gpsTrackingEnabled = await isGpsTrackingEnabled(ctx.tenantId);
    const gpsCapture = normalizeGpsBody(body, gpsTrackingEnabled);

    const { entry, instalment } = await submitCollectionEntry({
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      userId: ctx.userId,
      branchId: ctx.branchId,
      role: ctx.role,
    }, {
      instalmentId: body.instalmentId,
      receivedAmount: body.receivedAmount,
      paymentMode: body.paymentMode,
      remarks: body.remarks ?? null,
      collectionDate: body.collectionDate ?? null,
      idempotencyKey: body.idempotencyKey,
      gps: gpsCapture,
    });

    if (gpsTrackingEnabled) {
      try {
        await Promise.all([
          verifyAndPersistCollectionLocation({
            entryId: entry.id,
            tenantId: ctx.tenantId,
            customerId: instalment.loan.customerId,
            latitude: gpsCapture.latitude,
            longitude: gpsCapture.longitude,
            isMocked: gpsCapture.isMocked,
          }),
          recordCollectionLocationPing({
            tenantId: ctx.tenantId,
            agentId: ctx.userId,
            branchId: instalment.loan.branchId ?? null,
            capture: gpsCapture,
          }),
        ]);
      } catch (error) {
        console.error('GPS verification failed:', error);
      }
    }

    return ok(entry);
  } catch (e: unknown) {
    const msg = errorMessage(e);
    if (msg === 'invalid_amount') return fail('Invalid amount', 400);
    if (msg === 'not_found') return fail('Instalment not found', 404);
    if (msg === 'forbidden') return fail('Forbidden', 403);
    if (msg.startsWith('already_paid')) return fail(msg, 409);
    if (errorCode(e) === 'P2002' || /duplicate|unique|already/i.test(msg)) {
      return fail('already_paid', 409);
    }
    return fail(msg || 'Collection failed', 500);
  }
}
