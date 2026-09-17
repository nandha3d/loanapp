/**
 * Geofence + idle math for field-agent accountability — pure and testable.
 *
 * We already GPS-stamp every collection and check address proximity; this adds
 * the alerting primitives that put us ahead of a basic live-map: flag a
 * collection recorded outside the customer's geofence, and flag an agent idle
 * beyond a threshold. Radius / idle thresholds are tenant-tunable via
 * AppSetting (keys below) — never hardcoded.
 */

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in metres between two lat/lng points (haversine). */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_M * c);
}

export type GeofenceCheck = {
  distanceMeters: number;
  withinFence: boolean;
};

/**
 * Check whether a collection point is within `radiusMeters` of the customer's
 * registered location. Returns the distance too, so the caller can log it.
 */
export function checkGeofence(
  customerLat: number,
  customerLng: number,
  collectionLat: number,
  collectionLng: number,
  radiusMeters: number,
): GeofenceCheck {
  const d = distanceMeters(customerLat, customerLng, collectionLat, collectionLng);
  return { distanceMeters: d, withinFence: d <= Math.max(radiusMeters, 0) };
}

/** True when the gap since the agent's last ping exceeds the idle threshold. */
export function isAgentIdle(
  lastPingAt: Date,
  now: Date,
  idleThresholdMinutes: number,
): boolean {
  const elapsedMin = (now.getTime() - lastPingAt.getTime()) / 60_000;
  return elapsedMin >= Math.max(idleThresholdMinutes, 0);
}

/** Tenant-tunable AppSetting keys (defaults applied by the caller). */
export const GEOFENCE_RADIUS_KEY = 'gps_geofence_radius_m';
export const GEOFENCE_IDLE_MINUTES_KEY = 'gps_idle_minutes';
export const GEOFENCE_DEFAULTS = { radiusMeters: 200, idleMinutes: 30 } as const;
