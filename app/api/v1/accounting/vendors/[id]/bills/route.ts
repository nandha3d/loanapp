import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { PremiumAccountingServiceError } from '@/lib/accounting/premiumMobileService';
import { createBill, listBills } from '@/lib/accounting/vendors';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    const page = req.nextUrl.searchParams.get('page');
    return ok(await listBills(auth.context, {
      vendorId: (await params).id,
      page: page === null ? undefined : Number(page),
    }));
  } catch (error) {
    return fail(message(error), status(error));
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    const body = await req.json();
    return ok(await createBill(auth.context, { ...body, vendorId: (await params).id }));
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
