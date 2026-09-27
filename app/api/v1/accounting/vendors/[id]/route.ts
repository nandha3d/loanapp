import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { PremiumAccountingServiceError } from '@/lib/accounting/premiumMobileService';
import { deactivateVendor, getVendor, updateVendor } from '@/lib/accounting/vendors';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    return ok(await getVendor(auth.context, (await params).id));
  } catch (error) {
    return fail(message(error), status(error));
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    return ok(await updateVendor(auth.context, (await params).id, await req.json()));
  } catch (error) {
    return fail(message(error), status(error));
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    await deactivateVendor(auth.context, (await params).id);
    return ok({ success: true });
  } catch (error) {
    return fail(message(error), status(error));
  }
}

function status(error: unknown) {
  return error instanceof PremiumAccountingServiceError ? error.status : 500;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Vendor action failed';
}
