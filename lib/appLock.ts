import { getSetting } from '@/lib/tenant';

/**
 * Tenant app-lock policy (mobile): whether the app asks for biometric/device
 * unlock, and how long it may sit in the background or idle before it does.
 * Set by the tenant's superadmin; every user of the tenant follows it.
 */
export const APP_LOCK_ENABLED_KEY = 'biometric_lock_required';
export const APP_LOCK_TIMEOUT_KEY = 'app_lock_timeout_minutes';

/** Selectable timeouts, in minutes. 0 = lock every time the app is left. */
export const APP_LOCK_TIMEOUT_OPTIONS = [0, 1, 5, 15, 30] as const;
/** 1 minute: a quick trip to the camera or a permission prompt does not re-lock. */
export const APP_LOCK_DEFAULT_TIMEOUT_MINUTES = 1;

/** A stored/submitted timeout, coerced to an allowed option (default if not one). */
export function normalizeAppLockTimeout(value: unknown): number {
  const n = Number.parseInt(String(value ?? ''), 10);
  return (APP_LOCK_TIMEOUT_OPTIONS as readonly number[]).includes(n) ? n : APP_LOCK_DEFAULT_TIMEOUT_MINUTES;
}

export async function getAppLockPolicy(tenantId: string) {
  const [enabled, timeout] = await Promise.all([
    getSetting(tenantId, APP_LOCK_ENABLED_KEY, 'false'),
    getSetting(tenantId, APP_LOCK_TIMEOUT_KEY, String(APP_LOCK_DEFAULT_TIMEOUT_MINUTES)),
  ]);
  return {
    biometricLockRequired: enabled === 'true',
    timeoutMinutes: normalizeAppLockTimeout(timeout),
    timeoutOptions: [...APP_LOCK_TIMEOUT_OPTIONS],
  };
}
