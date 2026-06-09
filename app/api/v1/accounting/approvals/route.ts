import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import {
  listPremiumApprovals,
  PremiumAccountingServiceError,
  reviewPremiumApproval,
} from '@/lib/accounting/premiumMobileService';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    return ok(await listPremiumApprovals(auth.context, {
      status: searchParams.get('status'),
      entityType: searchParams.get('entityType'),
      limit: searchParams.get('limit'),
    }));
  } catch (error) {
    return fail(message(error, 'Approvals failed'), status(error));
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    return ok(await reviewPremiumApproval(auth.context, {
      approvalId: typeof body.approvalId === 'string' ? body.approvalId : null,
      action: typeof body.action === 'string' ? body.action : null,
      note: typeof body.note === 'string' ? body.note : null,
    }));
  } catch (error) {
    return fail(message(error, 'Approval action failed'), status(error));
  }
}

function status(error: unknown) {
  return error instanceof PremiumAccountingServiceError ? error.status : 500;
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
