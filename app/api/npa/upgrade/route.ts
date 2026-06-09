import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getNpaUpgradeEligibility,
  NpaServiceError,
  type NpaActor,
  upgradeNpaLoan,
} from '@/lib/npa/npaService';

type WebSessionUser = {
  id?: string | null;
  tenantId?: string | null;
  role?: string | null;
  branchId?: string | null;
  appType?: string | null;
};

function actorFromSession(user: WebSessionUser | undefined): NpaActor | null {
  if (!user?.id || !user.tenantId || !user.role) return null;
  return {
    tenantId: user.tenantId,
    userId: user.id,
    role: user.role,
    branchId: user.branchId ?? null,
    appType: user.appType ?? null,
  };
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof NpaServiceError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : 'NPA upgrade failed';
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const actor = actorFromSession(session?.user as WebSessionUser | undefined);
  if (!actor) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    await upgradeNpaLoan(actor, {
      loanId: typeof body.loanId === 'string' ? body.loanId : null,
      notes: typeof body.notes === 'string' ? body.notes : '',
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const actor = actorFromSession(session?.user as WebSessionUser | undefined);
  if (!actor) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const data = await getNpaUpgradeEligibility(actor, { loanId: searchParams.get('loanId') });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}
