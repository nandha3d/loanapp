import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { listPendingSelfPay, reconcileSelfPayToken, rejectSelfPayToken } from '@/lib/selfPay';

const STAFF_ROLES = new Set(['admin', 'superadmin', 'developer']);

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!STAFF_ROLES.has(ctx.role)) return fail('Forbidden', 403);

  try {
    const rows = await listPendingSelfPay(
      ctx.tenantId,
      ctx.role === 'superadmin' || ctx.role === 'developer' ? null : ctx.branchId,
    );
    return ok({ data: rows });
  } catch (e: any) {
    return fail(e?.message ?? 'Self-pay queue failed', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!STAFF_ROLES.has(ctx.role)) return fail('Forbidden', 403);

  try {
    const body = await req.json().catch(() => ({})) as {
      action?: string;
      token?: string;
    };
    const token = body.token?.trim();
    if (!token) return fail('token is required', 400);

    if (body.action === 'confirm') {
      const result = await reconcileSelfPayToken({ token, agentId: ctx.userId });
      if (result.status === 'invalid') return fail('Invalid token', 404);
      return ok(result);
    }

    if (body.action === 'reject') {
      const result = await rejectSelfPayToken(token);
      if (result.status === 'invalid') return fail('Invalid token', 404);
      return ok(result);
    }

    return fail('Invalid action', 400);
  } catch (e: any) {
    return fail(e?.message ?? 'Self-pay action failed', 500);
  }
}
