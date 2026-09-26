import { NextRequest } from 'next/server';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { fail, ok } from '@/lib/api/v1-envelope';
import { createPackage, listPackages, PackageError } from '@/lib/packages/service';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    return ok(await listPackages(auth.context, new URL(req.url).searchParams.get('includeInactive') === '1'));
  } catch (error) {
    return error instanceof PackageError ? fail(error.message, error.status) : fail('Packages failed', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    return ok(await createPackage(auth.context, await req.json()));
  } catch (error) {
    return error instanceof PackageError ? fail(error.message, error.status) : fail('Package create failed', 500);
  }
}
