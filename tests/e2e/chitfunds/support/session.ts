/**
 * Cookie reuse across chit specs.
 *
 * Same approach as the micro-lending suite, with its own jar directory: the two
 * suites provision different tenants, so sharing a cookie cache between them
 * would authenticate a chit spec as a micro-lending operator and the failure
 * would read as a permissions bug.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { login } from './ui';

const DIR = path.resolve(__dirname, '../../../../test-results/chit-sessions');

export type RoleKey = 'owner' | 'ownerB' | 'admin' | 'agentHq' | 'borrower';

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
    await page.context().addCookies(JSON.parse(fs.readFileSync(cached, 'utf8')));
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

/** Call a session-authenticated route with a cached role's cookies. */
export async function sessionFetch(role: RoleKey, target: string, init: RequestInit = {}) {
  const cached = file(role);
  if (!fs.existsSync(cached)) {
    throw new Error(`No cached ${role} session — log in through ensureSession() first.`);
  }
  const jar: Array<{ name: string; value: string }> = JSON.parse(fs.readFileSync(cached, 'utf8'));
  const cookie = jar.map((c) => `${c.name}=${c.value}`).join('; ');
  const base = process.env.E2E_BASE_URL || 'http://localhost:3100';
  return fetch(`${base}${target}`, { ...init, headers: { ...(init.headers ?? {}), cookie } });
}
