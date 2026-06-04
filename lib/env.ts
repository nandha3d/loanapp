/**
 * Startup env validation (SEC-03 / INFRA-11).
 *
 * Imported at app boot via `instrumentation.ts`. Throws on missing
 * required secrets so we fail fast instead of silently running with
 * weak defaults (NextAuth + PII encryption).
 */

const REQUIRED = [
  'DATABASE_URL',
  'PII_ENCRYPTION_KEY',
  'MOBILE_JWT_SECRET',
] as const;

const RECOMMENDED = [
  'CRON_SECRET',
  'APP_URL',
  'WEB_APP_URL',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_ROOT_DOMAIN',
  'APP_ROOT_DOMAIN',
] as const;

let _validated = false;

export function validateEnv(): void {
  if (_validated) return;
  _validated = true;

  const missing: string[] = [];
  for (const key of REQUIRED) {
    const v = process.env[key];
    if (!v || v.trim() === '') missing.push(key);
  }

  // The session secret may be supplied as AUTH_SECRET (NextAuth v5 canonical)
  // or NEXTAUTH_SECRET (legacy). Every module that signs/verifies tokens —
  // web (lib/auth.ts), middleware, borrower portal, and mobile
  // (lib/api/v1-auth.ts) — falls back across this same set, so accept either
  // here. Requiring one specific name caused a boot-time crash when the other
  // was set (e.g. shipped .env uses NEXTAUTH_SECRET, deploy README uses
  // AUTH_SECRET).
  const sessionSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!sessionSecret || sessionSecret.trim() === '') {
    missing.push('AUTH_SECRET (or NEXTAUTH_SECRET)');
  }

  if (missing.length > 0) {
    const msg = `FATAL: Missing required env vars: ${missing.join(', ')}`;
    // In prod -> throw. Dev -> warn loudly so docker compose etc. still works.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg);
    }
    console.error(`[ENV_VALIDATE] ${msg}`);
  }

  // SEC-04: PII key must have enough entropy. Accept 64-hex (32 raw bytes),
  // a 32-byte utf8 string, or a passphrase >= 24 chars. Anything weaker
  // throws in prod.
  const piiKey = process.env.PII_ENCRYPTION_KEY || '';
  if (piiKey) {
    const ok =
      /^[a-f0-9]{64}$/i.test(piiKey) ||
      Buffer.byteLength(piiKey, 'utf8') >= 24;
    if (!ok) {
      const msg = `FATAL: PII_ENCRYPTION_KEY too weak (need 64 hex chars OR >= 24 utf8 bytes).`;
      if (process.env.NODE_ENV === 'production') throw new Error(msg);
      console.error(`[ENV_VALIDATE] ${msg}`);
    }
  }

  // Auth secret length sanity check (whichever name was supplied).
  const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';
  if (authSecret && authSecret.length < 32) {
    const msg = `FATAL: AUTH_SECRET/NEXTAUTH_SECRET too short (need >= 32 chars).`;
    if (process.env.NODE_ENV === 'production') throw new Error(msg);
    console.error(`[ENV_VALIDATE] ${msg}`);
  }

  const missingRec = RECOMMENDED.filter((k) => !process.env[k]);
  if (missingRec.length > 0) {
    console.warn(
      `[ENV_VALIDATE] Recommended env vars not set: ${missingRec.join(', ')}`,
    );
  }
}
