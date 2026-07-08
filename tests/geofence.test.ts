import assert from 'node:assert/strict';
import {
  distanceMeters,
  checkGeofence,
  isAgentIdle,
  GEOFENCE_DEFAULTS,
} from '../lib/gps/geofence';

// ── distanceMeters ────────────────────────────────────────────────────────────
// Same point = 0
assert.equal(distanceMeters(12.9716, 77.5946, 12.9716, 77.5946), 0);

// ~1.11 km per 0.01° of latitude near the equator/India
{
  const d = distanceMeters(12.9716, 77.5946, 12.9806, 77.5946);
  assert.ok(d > 950 && d < 1050, `expected ~1km, got ${d}`);
}

// Bengaluru → Mysuru is ~125-145 km
{
  const d = distanceMeters(12.9716, 77.5946, 12.2958, 76.6394);
  assert.ok(d > 120_000 && d < 150_000, `expected ~130km, got ${d}`);
}

// ── checkGeofence ─────────────────────────────────────────────────────────────
{
  // 50m away, 200m fence → inside
  const near = checkGeofence(12.9716, 77.5946, 12.97205, 77.5946, 200);
  assert.equal(near.withinFence, true);

  // ~1km away, 200m fence → outside
  const far = checkGeofence(12.9716, 77.5946, 12.9806, 77.5946, 200);
  assert.equal(far.withinFence, false);
  assert.ok(far.distanceMeters > 200);
}

// ── isAgentIdle ───────────────────────────────────────────────────────────────
{
  const now = new Date('2026-06-29T10:00:00Z');
  assert.equal(isAgentIdle(new Date('2026-06-29T09:20:00Z'), now, 30), true); // 40 min
  assert.equal(isAgentIdle(new Date('2026-06-29T09:45:00Z'), now, 30), false); // 15 min
}

// ── defaults ──────────────────────────────────────────────────────────────────
assert.equal(GEOFENCE_DEFAULTS.radiusMeters, 200);
assert.equal(GEOFENCE_DEFAULTS.idleMinutes, 30);

console.log('geofence tests passed');
