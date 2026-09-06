/**
 * Cookie reuse across tests.
 *
 * A UI login costs a few seconds and the app re-reads role/branch from the
 * database on every session read anyway, so there is nothing to gain from
 * logging in again in each test. The cookies are cached per role for the run.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { login } from './ui';

const DIR = path.resolve(__dirname, '../../../../test-results/ml-sessions');

export type RoleKey = 'owner' | 'ownerB' | 'admin' | 'agentHq' | 'agentErode';

function file(role: RoleKey) {
  return path.join(DIR, `${role}.json`);
}

export function forgetSession(role: RoleKey) {
  try {
    fs.unlinkSync(file(role));
  } catch {
    /* nothing cached */
  }
}

export async function ensureSession(
  page: Page,
  role: RoleKey,
  creds: { username: string; password: string },
): Promise<void> {
  const cached = file(role);
  if (fs.existsSync(cached)) {
    const cookies = JSON.parse(fs.readFileSync(cached, 'utf8'));
    await page.context().addCookies(cookies);
    return;
  }

  const settled = await login(page, creds.username, creds.password);
  if (settled.includes('/login')) {
    throw new Error(`Could not establish a ${role} session for ${creds.username} — login was refused.`);
  }
  const cookies = await page.context().cookies();
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(cached, JSON.stringify(cookies, null, 2), 'utf8');
}

/** Drop every cached cookie jar — called at the top of a run, which provisions a new tenant. */
export function resetSessions() {
  fs.rmSync(DIR, { recursive: true, force: true });
}

/**
 * Call a session-authenticated route with a cached role's cookies.
 *
 * Some routes under /api/v1 authenticate by NextAuth session rather than by
 * bearer token (the report exports, for one), so a JWT client cannot reach
 * them. This sends exactly what the operator's browser would.
 */
export async function sessionFetch(role: RoleKey, path: string, init: RequestInit = {}) {
  const cached = file(role);
  if (!fs.existsSync(cached)) {
    throw new Error(`No cached ${role} session — log in through ensureSession() first.`);
  }
  const jar: Array<{ name: string; value: string }> = JSON.parse(fs.readFileSync(cached, 'utf8'));
  const cookie = jar.map((c) => `${c.name}=${c.value}`).join('; ');
  const base = process.env.E2E_BASE_URL || 'http://localhost:3100';

  return fetch(`${base}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), cookie },
  });
}
