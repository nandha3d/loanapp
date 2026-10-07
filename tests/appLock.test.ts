import assert from 'node:assert/strict';
import {
  APP_LOCK_DEFAULT_TIMEOUT_MINUTES,
  APP_LOCK_TIMEOUT_OPTIONS,
  normalizeAppLockTimeout,
} from '../lib/appLock';
import { SETTING_KEY_MIN_ROLE } from '../lib/settings/keyPolicy';

for (const n of APP_LOCK_TIMEOUT_OPTIONS) {
  assert.equal(normalizeAppLockTimeout(n), n, `option ${n} is kept`);
  assert.equal(normalizeAppLockTimeout(String(n)), n, `stored "${n}" is kept`);
}
assert.equal(normalizeAppLockTimeout(7), APP_LOCK_DEFAULT_TIMEOUT_MINUTES, 'a value that is not an option falls back');
assert.equal(normalizeAppLockTimeout(-1), APP_LOCK_DEFAULT_TIMEOUT_MINUTES);
assert.equal(normalizeAppLockTimeout('abc'), APP_LOCK_DEFAULT_TIMEOUT_MINUTES);
assert.equal(normalizeAppLockTimeout(undefined), APP_LOCK_DEFAULT_TIMEOUT_MINUTES);
assert.ok(APP_LOCK_TIMEOUT_OPTIONS.includes(0), 'lock-on-every-resume stays selectable');

// The lock keys are written only through /api/v1/settings/security (owner-only),
// never through the generic settings endpoint.
assert.equal(SETTING_KEY_MIN_ROLE.biometric_lock_required, undefined);
assert.equal(SETTING_KEY_MIN_ROLE.app_lock_timeout_minutes, undefined);

console.log('appLock: ok');
