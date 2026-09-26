import { NextRequest } from 'next/server';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { fail, ok } from '@/lib/api/v1-envelope';
import { deleteManagedRoute, RouteError, updateManagedRoute } from '@/lib/routes/service';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const body = await req.json();
    if (typeof body.name !== 'string') return fail('Route name required', 400);
    return ok(await updateManagedRoute(auth.context, id, body.name));
  } catch (error) {
    return error instanceof RouteError ? fail(error.message, error.status) : fail('Route update failed', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    await deleteManagedRoute(auth.context, (await params).id);
    return ok({ deleted: true });
  } catch (error) {
    return error instanceof RouteError ? fail(error.message, error.status) : fail('Route delete failed', 500);
  }
}
