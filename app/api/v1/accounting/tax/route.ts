import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import {
  getPremiumTaxSummary,
  PremiumAccountingServiceError,
} from '@/lib/accounting/premiumMobileService';
import { getTdsRegister, markGstFiled, recomputeGstSummary, recordChallan } from '@/lib/accounting/tax';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('view') === 'tds') {
      return ok(await getTdsRegister(auth.context, searchParams.get('quarterKey') ?? ''));
    }
    return ok(await getPremiumTaxSummary(auth.context, {
      periodKey: searchParams.get('periodKey'),
    }));
  } catch (error) {
    return fail(message(error, 'Tax failed'), status(error));
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Invalid action', 400);
    if (body.action === 'recompute') return ok(await recomputeGstSummary(auth.context, body.periodKey));
    if (body.action === 'mark_filed') return ok(await markGstFiled(auth.context, body.periodKey, body.ackNo));
    if (body.action === 'record_challan') return ok(await recordChallan(auth.context, body));
    return fail('Invalid action', 400);
  } catch (error) {
    return fail(message(error, 'Tax action failed'), status(error));
  }
}

function status(error: unknown) {
  return error instanceof PremiumAccountingServiceError ? error.status : 500;
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
