import { NextRequest } from 'next/server';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { fail, ok } from '@/lib/api/v1-envelope';
import { assignManagedRouteAgent, removeManagedRouteAgent, RouteError } from '@/lib/routes/service';

async function mutate(req: NextRequest, id: string, remove: boolean) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    const body = await req.json();
    if (typeof body.agentId !== 'string' || !body.agentId) return fail('Agent ID required', 400);
    if (remove) await removeManagedRouteAgent(auth.context, id, body.agentId);
    else await assignManagedRouteAgent(auth.context, id, body.agentId);
    return ok({ updated: true });
  } catch (error) {
    return error instanceof RouteError ? fail(error.message, error.status) : fail('Route agent update failed', 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return mutate(req, (await params).id, false);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return mutate(req, (await params).id, true);
}
