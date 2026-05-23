import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { upgradeNpaToStandard, checkUpgradeEligibility } from '@/lib/npa/npaUpgrade';

/**
 * POST /api/npa/upgrade — Admin-triggered NPA upgrade (NPA → Standard)
 * GET  /api/npa/upgrade?loanId=xxx — Check upgrade eligibility
 *
 * Subscription-gated: requires npaEnabled = true.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  const role = user.role;

  if (!['admin', 'superadmin'].includes(role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // Check subscription gating
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId: user.tenantId },
    select: { npaEnabled: true },
  });

  if (!subscription || !subscription.npaEnabled) {
    return NextResponse.json(
      { success: false, error: 'NPA Classification module is not enabled for your subscription.' },
      { status: 403 }
    );
  }

  const { loanId, notes } = await req.json();
  if (!loanId) {
    return NextResponse.json({ success: false, error: 'loanId is required' }, { status: 400 });
  }

  try {
    await upgradeNpaToStandard(loanId, user.id, user.tenantId, notes ?? '');
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const statusCode = err.message?.startsWith('UPGRADE_NOT_ELIGIBLE') ? 400 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status: statusCode });
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  const role = user.role;

  if (!['admin', 'superadmin'].includes(role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // Check subscription gating
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId: user.tenantId },
    select: { npaEnabled: true },
  });

  if (!subscription || !subscription.npaEnabled) {
    return NextResponse.json(
      { success: false, error: 'NPA Classification module is not enabled for your subscription.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const loanId = searchParams.get('loanId');

  if (!loanId) {
    return NextResponse.json({ success: false, error: 'loanId query param is required' }, { status: 400 });
  }

  try {
    const result = await checkUpgradeEligibility(loanId);
    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
