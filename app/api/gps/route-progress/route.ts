import { NextResponse } from 'next/server';
import { requireApiContext, ADMIN_API_ROLES, isApiError } from '@/lib/apiAuth';
import { isGpsTrackingEnabled } from '@/lib/gps/locationVerifier';
import { getRouteProgressForBranch } from '@/lib/gps/routeProgress';

export async function GET() {
  const result = await requireApiContext(ADMIN_API_ROLES);
  if (isApiError(result)) return result.response;
  const { tenantId, appType, branchId } = result.context;

  const gpsTrackingEnabled = await isGpsTrackingEnabled(tenantId);
  if (!gpsTrackingEnabled) {
    return NextResponse.json(
      { success: false, error: 'GPS Collection Tracking is not enabled for your subscription.' },
      { status: 403 },
    );
  }

  const agents = await getRouteProgressForBranch({
    tenantId,
    appType,
    branchId,
  });

  return NextResponse.json({ success: true, agents });
}
