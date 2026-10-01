import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  SETTING_KEY_MIN_ROLE,
  DEAD_KEYS,
  SECRET_KEYS,
  ROLE_RANK,
  GET,
  POST,
} from '../app/api/v1/settings/route';
import { issueMobileToken } from '../lib/api/v1-auth';

// ── 1. Static Configuration Verification ─────────────────────────────────────
assert.equal(SETTING_KEY_MIN_ROLE.interest_only_enabled, 'superadmin');
assert.equal(SETTING_KEY_MIN_ROLE.bullet_term_enabled, 'superadmin');
assert.equal(SETTING_KEY_MIN_ROLE.theme_preset, 'superadmin');
assert.equal(SETTING_KEY_MIN_ROLE.primary_color, 'superadmin');

assert.equal(SETTING_KEY_MIN_ROLE.app_name, 'developer');
assert.equal(SETTING_KEY_MIN_ROLE.currency, 'developer');
assert.equal(SETTING_KEY_MIN_ROLE.kyc_method, 'developer');
assert.equal(SETTING_KEY_MIN_ROLE.midnight_cutoff, 'developer');

assert.equal(SETTING_KEY_MIN_ROLE.default_penalty_per_day, 'admin');
assert.equal(SETTING_KEY_MIN_ROLE.upi_id, 'admin');
assert.equal(SETTING_KEY_MIN_ROLE.msg91_auth_key, 'admin');
assert.equal(SETTING_KEY_MIN_ROLE.smtp_pass, 'admin');

for (const dead of [
  'bulk_collection_allowed',
  'bulk_limit_per_agent',
  'bureau_member_id',
  'bureau_api_key',
  'bureau_pulls_enabled',
  'npa_threshold_days',
  'npa_penalty_rate',
  'session_timeout_minutes',
]) {
  assert.ok(DEAD_KEYS.has(dead), `Dead key ${dead} must be in DEAD_KEYS`);
  assert.equal(SETTING_KEY_MIN_ROLE[dead], undefined, `Dead key ${dead} must not be in allow-list`);
}

assert.ok(SECRET_KEYS.has('msg91_auth_key'));
assert.ok(SECRET_KEYS.has('smtp_pass'));

// ── 2. Live Request Gating (POST) ───────────────────────────────────────────
async function runSettingsSecurityTests() {
  process.env.MOBILE_JWT_SECRET = 'test-mobile-jwt-secret-at-least-32-chars-long';
  const adminToken = await issueMobileToken({
    userId: 'u-admin',
    tenantId: 'tenant-test',
    branchId: 'b-erode',
    role: 'admin',
    appType: 'microlending',
  });

  const superadminToken = await issueMobileToken({
    userId: 'u-sa',
    tenantId: 'tenant-test',
    branchId: 'b-erode',
    role: 'superadmin',
    appType: 'microlending',
  });

  // Admin attempting to set a superadmin feature flag -> 403
  const resForbidden = await POST(
    new NextRequest('http://localhost/api/v1/settings', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ interest_only_enabled: '1' }),
    }),
  );
  assert.equal(resForbidden.status, 403, 'Admin must not be able to write superadmin feature flag');

  // Admin attempting to set a developer system key -> 403
  const resDevForbidden = await POST(
    new NextRequest('http://localhost/api/v1/settings', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ app_name: 'HackedName' }),
    }),
  );
  assert.equal(resDevForbidden.status, 403, 'Admin must not be able to write developer setting');

  // Superadmin attempting to set a developer system key -> 403
  const resSaDevForbidden = await POST(
    new NextRequest('http://localhost/api/v1/settings', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${superadminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ app_name: 'HackedName' }),
    }),
  );
  assert.equal(resSaDevForbidden.status, 403, 'Superadmin must not be able to write developer setting');

  // Attempting to write a dead key -> 400
  const resDead = await POST(
    new NextRequest('http://localhost/api/v1/settings', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${superadminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ bureau_member_id: 'CRIF123' }),
    }),
  );
  assert.equal(resDead.status, 400, 'Dead keys must be rejected with 400');

  // Attempting to write an unknown key -> 400
  const resUnknown = await POST(
    new NextRequest('http://localhost/api/v1/settings', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${superadminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ totally_unknown_key: 'value' }),
    }),
  );
  assert.equal(resUnknown.status, 400, 'Unknown keys must be rejected with 400');

  console.log('settingsSecurity tests passed');
}

runSettingsSecurityTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
