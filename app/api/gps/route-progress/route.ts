import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isGpsTrackingEnabled } from '@/lib/gps/locationVerifier';
import { getRouteProgressForBranch } from '@/lib/gps/routeProgress';

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!['admin', 'superadmin', 'developer'].includes(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const gpsTrackingEnabled = await isGpsTrackingEnabled(user.tenantId);
  if (!gpsTrackingEnabled) {
    return NextResponse.json(
      { success: false, error: 'GPS Collection Tracking is not enabled for your subscription.' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get('branchId') || user.branchId || null;
  const agents = await getRouteProgressForBranch({
    tenantId: user.tenantId,
    branchId,
  });

  return NextResponse.json({ success: true, agents });
}
