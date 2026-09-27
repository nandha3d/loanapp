import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { PremiumAccountingServiceError } from '@/lib/accounting/premiumMobileService';
import { cancelBill, getBill, payBill, postBill } from '@/lib/accounting/vendors';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    return ok(await getBill(auth.context, (await params).id));
  } catch (error) {
    return fail(message(error), status(error));
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    const body = await req.json();
    const id = (await params).id;
    if (body.action === 'post') return ok(await postBill(auth.context, id));
    if (body.action === 'pay') return ok(await payBill(auth.context, id, body));
    if (body.action === 'cancel') return ok(await cancelBill(auth.context, id));
    return fail('Invalid action', 400);
  } catch (error) {
    return fail(message(error), status(error));
  }
}

function status(error: unknown) {
  return error instanceof PremiumAccountingServiceError ? error.status : 500;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Bill action failed';
}
