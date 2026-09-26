import { NextRequest } from 'next/server';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { fail, ok } from '@/lib/api/v1-envelope';
import { RouteError, setManagedPrimaryAgent } from '@/lib/routes/service';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    const body = await req.json();
    if (!Object.hasOwn(body, 'agentId') || (body.agentId !== null && typeof body.agentId !== 'string')) {
      return fail('Agent ID or null required', 400);
    }
    await setManagedPrimaryAgent(auth.context, (await params).id, body.agentId);
    return ok({ updated: true });
  } catch (error) {
    return error instanceof RouteError ? fail(error.message, error.status) : fail('Primary agent update failed', 500);
  }
}
