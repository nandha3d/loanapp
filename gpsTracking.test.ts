import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_GPS_THRESHOLD_METRES,
  haversineDistance,
  normalizeGpsFormData,
  verifyGpsAgainstGeocode,
} from './lib/gps/locationVerifier';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

const chennaiCentralToEgmore = haversineDistance(13.0827, 80.2707, 13.0732, 80.2609);
assert.ok(
  chennaiCentralToEgmore > 1400 && chennaiCentralToEgmore < 1600,
  `ML-2107 expected known Chennai coordinates to be about 1.5km, got ${chennaiCentralToEgmore}`,
);

const verified = verifyGpsAgainstGeocode(
  { latitude: 13.0827, longitude: 80.2707 },
  { latitude: 13.083, longitude: 80.271 },
  DEFAULT_GPS_THRESHOLD_METRES,
);
assert.equal(verified.status, 'verified', 'ML-2104 nearby collection GPS should verify');
assert.equal(verified.withinThreshold, true, 'ML-2104 nearby collection GPS is inside threshold');
assert.ok((verified.distanceMetres ?? 0) < 100, 'ML-2104 nearby collection distance is recorded');

const mismatch = verifyGpsAgainstGeocode(
  { latitude: 13.0827, longitude: 80.2707 },
  { latitude: 12.9716, longitude: 77.5946 },
  DEFAULT_GPS_THRESHOLD_METRES,
);
assert.equal(mismatch.status, 'mismatch', 'ML-2105 far-away collection GPS should mismatch');
assert.equal(mismatch.withinThreshold, false, 'ML-2105 far-away collection GPS is outside threshold');

const noBorrowerGeocode = verifyGpsAgainstGeocode(
  { latitude: 13.0827, longitude: 80.2707 },
  null,
  DEFAULT_GPS_THRESHOLD_METRES,
);
assert.equal(noBorrowerGeocode.status, 'unverifiable', 'ML-2106 missing customer geocode should be unverifiable');

const capturedForm = new FormData();
capturedForm.set('gpsStatus', 'captured');
capturedForm.set('gpsLatitude', '13.0827');
capturedForm.set('gpsLongitude', '80.2707');
capturedForm.set('gpsAccuracy', '14');
capturedForm.set('gpsTimestamp', '2026-05-24T10:00:00.000Z');
const captured = normalizeGpsFormData(capturedForm, true);
assert.equal(captured.locationStatus, 'pending_verification', 'ML-2101 captured GPS starts pending verification');
assert.equal(captured.latitude, 13.0827, 'ML-2101 latitude is parsed');
assert.equal(captured.longitude, 80.2707, 'ML-2101 longitude is parsed');
assert.equal(captured.gpsAccuracy, 14, 'ML-2101 accuracy is parsed');

const deniedForm = new FormData();
deniedForm.set('gpsStatus', 'location_denied');
const denied = normalizeGpsFormData(deniedForm, true);
assert.equal(denied.locationStatus, 'location_denied', 'ML-2102 denied GPS is flagged, not blocked');
assert.equal(denied.latitude, null, 'ML-2102 denied GPS has no coordinates');

const timeoutForm = new FormData();
timeoutForm.set('gpsStatus', 'gps_timeout');
const timeout = normalizeGpsFormData(timeoutForm, true);
assert.equal(timeout.locationStatus, 'gps_timeout', 'ML-2103 timeout GPS is flagged, not blocked');

const disabled = normalizeGpsFormData(capturedForm, false);
assert.equal(disabled.locationStatus, 'not_captured', 'GPS fields are ignored when add-on is disabled');
assert.equal(disabled.latitude, null, 'GPS coords are ignored when add-on is disabled');

const schema = read('prisma/schema.prisma');
assert.match(schema, /gpsTrackingEnabled\s+Boolean\s+@default\(false\)\s+@map\("gps_tracking_enabled"\)/, 'subscription has gpsTrackingEnabled add-on flag');
assert.match(schema, /model AgentLocationPing/, 'AgentLocationPing model exists for heartbeat tracking');
assert.match(schema, /model RouteStop/, 'Ganand GPS model includes route stops for ordered route planning');
assert.match(schema, /lat\s+Float(?:\s+@map\("lat"\))?/, 'AgentLocationPing uses Ganand lat column');
assert.match(schema, /lng\s+Float(?:\s+@map\("lng"\))?/, 'AgentLocationPing uses Ganand lng column');
assert.match(schema, /accuracyM\s+Float\?\s+@map\("accuracy_m"\)/, 'AgentLocationPing uses accuracyM');
assert.match(schema, /capturedAt\s+DateTime\s+@map\("captured_at"\)/, 'AgentLocationPing stores capturedAt');
assert.match(schema, /receivedAt\s+DateTime\s+@default\(now\(\)\)\s+@map\("received_at"\)/, 'AgentLocationPing stores receivedAt');
assert.doesNotMatch(schema, /deviceTime\s+DateTime\s+@map\("device_time"\)/, 'old deviceTime GPS field is removed');
assert.doesNotMatch(schema, /serverTime\s+DateTime\s+@default\(now\(\)\)\s+@map\("server_time"\)/, 'old serverTime GPS field is removed');
assert.match(schema, /model CustomerGeocode/, 'CustomerGeocode model exists for borrower location verification');
assert.match(schema, /gpsAccuracyM\s+Float\?\s+@map\("gps_accuracy_m"\)/, 'CollectionEntry uses Ganand gpsAccuracyM column');
assert.match(schema, /gpsCapturedAt\s+DateTime\?\s+@map\("gps_captured_at"\)/, 'CollectionEntry uses Ganand gpsCapturedAt column');
assert.match(schema, /distanceFromCustomerM\s+Float\?\s+@map\("distance_from_customer_m"\)/, 'CollectionEntry stores distance from customer');
assert.match(schema, /locationStatus\s+String\s+@default\("not_captured"\)\s+@map\("location_status"\)/, 'CollectionEntry stores location status');

const billingAction = read('app/admin/billing/billingActions.ts');
assert.match(billingAction, /gpsTrackingEnabled/, 'billing action persists GPS add-on flag');

const subscriptionForm = read('app/admin/billing/[tenantId]/SubscriptionForm.tsx');
assert.match(subscriptionForm, /gpsTrackingEnabled/, 'developer billing form exposes GPS add-on toggle');

const collectionActions = read('app/(dashboard)/[module]/collection/actions.ts');
assert.match(collectionActions, /normalizeGpsFormData/, 'web collection action normalizes GPS payload');
assert.match(collectionActions, /verifyAndPersistCollectionLocation/, 'web collection action verifies GPS after save');

const heartbeatRoute = read('app/api/gps/heartbeat/route.ts');
assert.match(heartbeatRoute, /gpsTrackingEnabled/, 'heartbeat API is subscription-gated');
assert.match(heartbeatRoute, /AgentLocationPing|agentLocationPing/, 'heartbeat API writes location pings');

console.log('GPS collection tracking checks passed');
