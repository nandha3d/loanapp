import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { isGpsTrackingEnabled } from '@/lib/gps/locationVerifier';

function validCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (user.role !== 'agent') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const gpsTrackingEnabled = await isGpsTrackingEnabled(user.tenantId);
  if (!gpsTrackingEnabled) {
    return NextResponse.json(
      { success: false, error: 'GPS Collection Tracking is not enabled for your subscription.' },
      { status: 403 },
    );
  }

  const body = await req.json();
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!validCoordinate(latitude, longitude)) {
    return NextResponse.json({ success: false, error: 'Valid latitude and longitude are required.' }, { status: 400 });
  }

  const deviceTime = body.deviceTime ? new Date(String(body.deviceTime)) : new Date();
  await prisma.agentLocationPing.create({
    data: {
      tenantId: user.tenantId,
      agentId: user.id,
      branchId: user.branchId ?? null,
      lat: latitude,
      lng: longitude,
      accuracyM: body.accuracy === undefined || body.accuracy === null ? null : Number(body.accuracy),
      pingType: body.pingType ? String(body.pingType) : 'heartbeat',
      capturedAt: Number.isNaN(deviceTime.getTime()) ? new Date() : deviceTime,
      isOnDuty: body.isOnDuty === undefined ? true : Boolean(body.isOnDuty),
    },
  });

  return NextResponse.json({ success: true });
}
