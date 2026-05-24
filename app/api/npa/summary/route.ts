import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { getTenantProvisioningSummary } from '@/lib/npa/provisioningCalculator';

/**
 * GET /api/npa/summary
 *
 * Returns tenant-level NPA overview: category counts, outstanding totals,
 * provisioning totals, and gross NPA ratio.
 * Subscription-gated: requires npaEnabled = true.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  const tenantId = user.tenantId;
  const role = user.role;

  if (!['admin', 'superadmin'].includes(role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // Check subscription gating
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { npaEnabled: true },
  });

  if (!subscription || !subscription.npaEnabled) {
    return NextResponse.json(
      { success: false, error: 'NPA Classification module is not enabled for your subscription.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const asOfDate = searchParams.get('date')
    ? new Date(searchParams.get('date')!)
    : new Date();

  const summary = await getTenantProvisioningSummary(tenantId, asOfDate);

  // Gross NPA ratio = (sub_standard + doubtful + loss outstanding) / total outstanding × 100
  const npaOutstanding =
    summary.sub_standard.outstanding +
    summary.doubtful.outstanding +
    summary.loss.outstanding;
  const grossNpaRatio =
    summary.total.outstanding > 0
      ? (npaOutstanding / summary.total.outstanding) * 100
      : 0;

  return NextResponse.json({
    success: true,
    data: {
      ...summary,
      grossNpaRatio: Math.round(grossNpaRatio * 100) / 100,
      asOfDate: asOfDate.toISOString(),
    },
  });
}
