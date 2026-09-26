import { NextRequest } from 'next/server';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { fail, ok } from '@/lib/api/v1-envelope';
import { createManagedRoute, listManagedRoutes, RouteError } from '@/lib/routes/service';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    return ok(await listManagedRoutes(auth.context));
  } catch {
    return fail('Routes failed', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    const body = await req.json();
    if (typeof body.name !== 'string' ||
        (body.assignedAgentId != null && typeof body.assignedAgentId !== 'string') ||
        (body.agentIds != null && (!Array.isArray(body.agentIds) || !body.agentIds.every((id: unknown) => typeof id === 'string')))) {
      return fail('Invalid route input', 400);
    }
    return ok(await createManagedRoute(auth.context, {
      name: body.name,
      primaryAgentId: body.assignedAgentId ?? null,
      sharedAgentIds: body.agentIds ?? [],
    }));
  } catch (error) {
    return error instanceof RouteError ? fail(error.message, error.status) : fail('Route create failed', 500);
  }
}
