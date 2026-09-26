import { ADMIN_API_ROLES, isApiError, requireApiContext } from '@/lib/apiAuth';
import { apiError, apiSuccess } from '@/lib/utils';
import { deletePackage, getPackage, PackageError, updatePackage } from '@/lib/packages/service';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireApiContext(ADMIN_API_ROLES);
  if (isApiError(auth)) return auth.response;
  try {
    return apiSuccess(await getPackage(auth.context, (await params).id));
  } catch (error) {
    return error instanceof PackageError ? apiError(error.message, error.status) : apiError('Package read failed', 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireApiContext(ADMIN_API_ROLES);
  if (isApiError(auth)) return auth.response;
  try {
    return apiSuccess(await updatePackage(auth.context, (await params).id, await request.json()));
  } catch (error) {
    return error instanceof PackageError ? apiError(error.message, error.status) : apiError('Package update failed', 500);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireApiContext(ADMIN_API_ROLES);
  if (isApiError(auth)) return auth.response;
  try {
    await deletePackage(auth.context, (await params).id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return error instanceof PackageError ? apiError(error.message, error.status) : apiError('Package delete failed', 500);
  }
}
