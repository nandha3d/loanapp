/**
 * Next.js instrumentation hook (runs once per server start).
 * Used to validate critical env vars at boot (SEC-03, SEC-04, INFRA-11).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('./lib/env');
    validateEnv();
  }
}
