import { ADMIN_API_ROLES, isApiError, requireApiContext } from '@/lib/apiAuth';
import { apiCreated, apiError, apiSuccess } from '@/lib/utils';
import { createPackage, listPackages, PackageError } from '@/lib/packages/service';

export async function GET() {
  const auth = await requireApiContext(ADMIN_API_ROLES);
  if (isApiError(auth)) return auth.response;
  try {
    return apiSuccess(await listPackages(auth.context));
  } catch (error) {
    return error instanceof PackageError ? apiError(error.message, error.status) : apiError('Packages failed', 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireApiContext(ADMIN_API_ROLES);
  if (isApiError(auth)) return auth.response;
  try {
    return apiCreated(await createPackage(auth.context, await request.json()));
  } catch (error) {
    return error instanceof PackageError ? apiError(error.message, error.status) : apiError('Package create failed', 500);
  }
}
