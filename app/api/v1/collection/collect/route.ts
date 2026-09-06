import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import {
  isGpsTrackingEnabled,
  normalizeGpsBody,
} from '@/lib/gps/locationVerifier';
import { recordActualLoanCollection } from '@/lib/collectionWrite';
import { CollectLoanSchema } from '@/lib/schemas/collectionEntry';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '';
}

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

/**
 * Loan-level collection submit. Body: `{loanId, amount, paymentMode, remarks?,
 * collectionDate?, idempotencyKey?, gps...}`. The amount is recorded on the
 * collection-date instalment for Actual; Distributed remains a display-only
 * projection. Shared by the web popup and online mobile sheet.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const rawBody = await req.json().catch(() => null);
    const parsed = CollectLoanSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
    }
    const body = parsed.data;
    const gpsTrackingEnabled = await isGpsTrackingEnabled(ctx.tenantId);
    const gpsCapture = normalizeGpsBody(body, gpsTrackingEnabled);

    const result = await recordActualLoanCollection(
      {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        userId: ctx.userId,
        branchId: ctx.branchId,
        role: ctx.role,
      },
      {
        loanId: body.loanId,
        amount: body.amount,
        paymentMode: body.paymentMode,
        remarks: body.remarks ?? null,
        collectionDate: body.collectionDate ?? null,
        idempotencyKey: body.idempotencyKey,
        gps: gpsCapture,
      },
    );

    return ok(result);
  } catch (e: unknown) {
    const msg = errorMessage(e);
    if (msg === 'invalid_amount') return fail('Invalid amount', 400);
    if (msg === 'not_found') return fail('Loan not found', 404);
    if (msg === 'forbidden') return fail('Forbidden', 403);
    if (msg.startsWith('already_paid')) return fail(msg, 409);
    if (errorCode(e) === 'P2002' || /duplicate|unique|already/i.test(msg)) {
      return fail('already_paid', 409);
    }
    return fail(msg || 'Collection failed', 500);
  }
}
