import { NextRequest } from 'next/server';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { fail, ok } from '@/lib/api/v1-envelope';
import { KycNotFoundError, reviewVideoKyc, startVideoKyc } from '@/lib/kyc';

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const actor = auth.context;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON', 400);
  }

  try {
    if (body.action === 'start') {
      if (typeof body.customerId !== 'string' || !body.customerId) return fail('Customer ID required', 400);
      return ok(await startVideoKyc(body.customerId, actor));
    }
    if (body.action === 'review') {
      if (!['admin', 'superadmin', 'developer'].includes(actor.role)) return fail('Forbidden', 403);
      if (typeof body.sessionId !== 'string' || !['approved', 'rejected'].includes(String(body.decision))) {
        return fail('Session ID and valid decision required', 400);
      }
      await reviewVideoKyc(body.sessionId, actor, body.decision as 'approved' | 'rejected', String(body.notes ?? ''));
      return ok({ reviewed: true });
    }
    return fail('Invalid action', 400);
  } catch (error) {
    if (error instanceof KycNotFoundError) return fail(error.message, 404);
    if (error instanceof Error && error.message.includes('not enabled for your subscription')) {
      return fail(error.message, 403);
    }
    return fail(error instanceof Error ? error.message : 'KYC failed', 400);
  }
}
