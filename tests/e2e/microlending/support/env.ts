/**
 * Loads .env.e2e into process.env for the Playwright worker.
 *
 * The suite talks to two things that must agree on secrets: the running Next
 * dev server, and this process (which signs email-verification tokens and mints
 * mobile JWTs directly). Both read the same file, so a mismatch is impossible.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const ENV_FILE = path.join(ROOT, '.env.e2e');

let loaded = false;

export function loadE2eEnv(): void {
  if (loaded) return;
  loaded = true;

  if (!fs.existsSync(ENV_FILE)) {
    throw new Error(
      `.env.e2e is missing at ${ENV_FILE}. It pins TEST_DATABASE_URL and the auth secrets ` +
        'shared with the dev server under test.',
    );
  }

  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }

  // Business-logic modules read DATABASE_URL; point them at the QA database.
  if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

export const BASE_URL = (() => {
  loadE2eEnv();
  return process.env.E2E_BASE_URL || 'http://localhost:3100';
})();

/** Guard copied from tests/e2e-business: never let this suite touch a live database. */
export function assertSafeTestDatabase(): string {
  loadE2eEnv();
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is required.');
  const name = new URL(url).pathname.replace(/^\/+/, '').toLowerCase();
  if (/prod|production|live/.test(name)) {
    throw new Error(`Refusing to run against database "${name}".`);
  }
  if (!/test|qa|e2e|ci/.test(name)) {
    throw new Error(`Refusing to run against database "${name}" — name must contain test/qa/e2e/ci.`);
  }
  return url;
}
