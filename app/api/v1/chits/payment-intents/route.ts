import { NextRequest } from 'next/server';
import { ok, fail , failFromError} from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { canCollectChits, isTenantWideRole } from '@/lib/chits/access';
import { listChitPaymentIntentsForStaff } from '@/lib/chits/paymentIntents';

// Staff queue of customer "I've paid" claims (doc 19), mobile counterpart of
// the web chits/payments page — same lib functions, no duplicated logic.
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!canCollectChits(ctx.role)) return fail('Forbidden', 403);

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const chitGroupId = searchParams.get('groupId');
    const intents = await listChitPaymentIntentsForStaff({
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      isTenantWide: isTenantWideRole(ctx.role),
      status: status === 'all' ? null : status || 'pending',
      chitGroupId: chitGroupId || null,
    });
    return ok({ intents });
  } catch (e: any) {
    return failFromError(e, 'Failed to load payment intents');
  }
}
