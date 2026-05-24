import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

/**
 * GET /api/v1/gps/agent/:id
 * Returns latest known location for agent. Admin only.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  if (!['admin', 'superadmin', 'developer'].includes(auth.context.role)) {
    return fail('Forbidden', 403);
  }
  const { id } = await ctx.params;

  try {
    const last = await prisma.agentLocationPing.findFirst({
      where: { agentId: id, tenantId: auth.context.tenantId },
      orderBy: { capturedAt: 'desc' },
    });
    if (!last) return ok(null);
    return ok(last);
  } catch (e: any) {
    return fail(e?.message ?? 'GPS lookup failed', 500);
  }
}
