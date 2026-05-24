import prisma from '@/lib/db';

export const DEFAULT_GPS_THRESHOLD_METRES = 500;

export type LocationStatus =
  | 'pending_verification'
  | 'verified'
  | 'mismatch'
  | 'unverifiable'
  | 'location_denied'
  | 'gps_timeout'
  | 'not_captured';

export type GpsCapture = {
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy: number | null;
  gpsTimestamp: Date | null;
  gpsAltitude: number | null;
  locationStatus: LocationStatus;
};

export type GeocodePoint = {
  latitude: number;
  longitude: number;
};

export type LocationVerificationResult = {
  status: LocationStatus;
  distanceMetres: number | null;
  thresholdMetres: number;
  withinThreshold: boolean;
  borrowerLat: number | null;
  borrowerLng: number | null;
};

function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validCoordinates(latitude: number | null, longitude: number | null) {
  return (
    latitude !== null &&
    longitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function normalizeGpsFormData(formData: FormData, enabled: boolean): GpsCapture {
  if (!enabled) {
    return emptyCapture('not_captured');
  }

  const rawStatus = String(formData.get('gpsStatus') || 'not_captured') as LocationStatus;
  if (rawStatus === 'location_denied' || rawStatus === 'gps_timeout') {
    return emptyCapture(rawStatus);
  }

  const latitude = parseOptionalNumber(formData.get('gpsLatitude'));
  const longitude = parseOptionalNumber(formData.get('gpsLongitude'));
  if (!validCoordinates(latitude, longitude)) {
    return emptyCapture('not_captured');
  }

  return {
    latitude,
    longitude,
    gpsAccuracy: parseOptionalNumber(formData.get('gpsAccuracy')),
    gpsTimestamp: parseOptionalDate(formData.get('gpsTimestamp')),
    gpsAltitude: parseOptionalNumber(formData.get('gpsAltitude')),
    locationStatus: 'pending_verification',
  };
}

export function normalizeGpsBody(body: any, enabled: boolean): GpsCapture {
  const formData = new FormData();
  const gps = body?.gps ?? body ?? {};
  if (gps.status) formData.set('gpsStatus', String(gps.status));
  if (gps.latitude !== undefined && gps.latitude !== null) formData.set('gpsLatitude', String(gps.latitude));
  if (gps.longitude !== undefined && gps.longitude !== null) formData.set('gpsLongitude', String(gps.longitude));
  if (gps.accuracy !== undefined && gps.accuracy !== null) formData.set('gpsAccuracy', String(gps.accuracy));
  if (gps.timestamp) formData.set('gpsTimestamp', String(gps.timestamp));
  if (gps.altitude !== undefined && gps.altitude !== null) formData.set('gpsAltitude', String(gps.altitude));
  return normalizeGpsFormData(formData, enabled);
}

function emptyCapture(locationStatus: LocationStatus): GpsCapture {
  return {
    latitude: null,
    longitude: null,
    gpsAccuracy: null,
    gpsTimestamp: null,
    gpsAltitude: null,
    locationStatus,
  };
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusMetres = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMetres * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function verifyGpsAgainstGeocode(
  agentPoint: GeocodePoint | null,
  borrowerPoint: GeocodePoint | null,
  thresholdMetres = DEFAULT_GPS_THRESHOLD_METRES,
): LocationVerificationResult {
  if (!agentPoint || !validCoordinates(agentPoint.latitude, agentPoint.longitude)) {
    return {
      status: 'not_captured',
      distanceMetres: null,
      thresholdMetres,
      withinThreshold: false,
      borrowerLat: null,
      borrowerLng: null,
    };
  }

  if (!borrowerPoint) {
    return {
      status: 'unverifiable',
      distanceMetres: null,
      thresholdMetres,
      withinThreshold: false,
      borrowerLat: null,
      borrowerLng: null,
    };
  }

  const distanceMetres = Math.round(
    haversineDistance(
      agentPoint.latitude,
      agentPoint.longitude,
      borrowerPoint.latitude,
      borrowerPoint.longitude,
    ),
  );
  const withinThreshold = distanceMetres <= thresholdMetres;
  return {
    status: withinThreshold ? 'verified' : 'mismatch',
    distanceMetres,
    thresholdMetres,
    withinThreshold,
    borrowerLat: borrowerPoint.latitude,
    borrowerLng: borrowerPoint.longitude,
  };
}

export async function isGpsTrackingEnabled(tenantId: string): Promise<boolean> {
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { gpsTrackingEnabled: true },
  });
  return Boolean(subscription?.gpsTrackingEnabled);
}

export async function verifyAndPersistCollectionLocation(input: {
  entryId: string;
  tenantId: string;
  customerId: string;
  latitude: number | null;
  longitude: number | null;
}) {
  if (!validCoordinates(input.latitude, input.longitude)) return;

  const geocode = await prisma.customerGeocode.findFirst({
    where: { tenantId: input.tenantId, customerId: input.customerId },
    select: { latitude: true, longitude: true },
  });

  const result = verifyGpsAgainstGeocode(
    { latitude: input.latitude!, longitude: input.longitude! },
    geocode,
    DEFAULT_GPS_THRESHOLD_METRES,
  );

  await prisma.collectionEntry.update({
    where: { id: input.entryId },
    data: {
      locationStatus: result.status,
      distanceFromBorrower: result.distanceMetres,
      borrowerLat: result.borrowerLat,
      borrowerLng: result.borrowerLng,
    },
  });
}

export async function recordCollectionLocationPing(input: {
  tenantId: string;
  agentId: string;
  branchId: string | null;
  capture: GpsCapture;
}) {
  if (!validCoordinates(input.capture.latitude, input.capture.longitude)) return;
  await prisma.agentLocationPing.create({
    data: {
      tenantId: input.tenantId,
      agentId: input.agentId,
      branchId: input.branchId,
      latitude: input.capture.latitude!,
      longitude: input.capture.longitude!,
      accuracy: input.capture.gpsAccuracy,
      pingType: 'collection',
      deviceTime: input.capture.gpsTimestamp ?? new Date(),
      isOnDuty: true,
    },
  });
}
