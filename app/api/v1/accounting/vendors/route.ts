import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { PremiumAccountingServiceError } from '@/lib/accounting/premiumMobileService';
import { createVendor, listVendors } from '@/lib/accounting/vendors';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = searchParams.get('page');
    return ok(await listVendors(auth.context, {
      search: searchParams.get('search') ?? undefined,
      isActive: null,
      page: page === null ? undefined : Number(page),
    }));
  } catch (error) {
    return fail(message(error, 'Vendors failed'), status(error));
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    return ok(await createVendor(auth.context, await req.json()));
  } catch (error) {
    return fail(message(error, 'Vendor creation failed'), status(error));
  }
}

function status(error: unknown) {
  return error instanceof PremiumAccountingServiceError ? error.status : 500;
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
