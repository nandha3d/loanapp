import { NextRequest } from 'next/server';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { fail, ok } from '@/lib/api/v1-envelope';
import { deletePackage, getPackage, PackageError, updatePackage } from '@/lib/packages/service';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    return ok(await getPackage(auth.context, (await params).id));
  } catch (error) {
    return error instanceof PackageError ? fail(error.message, error.status) : fail('Package read failed', 500);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    return ok(await updatePackage(auth.context, (await params).id, await req.json()));
  } catch (error) {
    return error instanceof PackageError ? fail(error.message, error.status) : fail('Package update failed', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    await deletePackage(auth.context, (await params).id);
    return ok({ deleted: true });
  } catch (error) {
    return error instanceof PackageError ? fail(error.message, error.status) : fail('Package delete failed', 500);
  }
}
