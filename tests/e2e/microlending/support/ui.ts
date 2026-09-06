import { expect, type Page } from '@playwright/test';
import { BASE_URL } from './env';

export const MODULE = 'microlending';

export function mpath(sub: string): string {
  return `/${MODULE}${sub.startsWith('/') ? sub : `/${sub}`}`;
}

/**
 * Wait until React has hydrated the node behind `selector`.
 *
 * Filling a controlled input before hydration sets the DOM value but never the
 * React state, so the form submits empty strings and the app answers "invalid
 * credentials" — a false failure that looks exactly like a real auth bug.
 * React attaches `__reactFiber$…` to a node when it hydrates it, so that key is
 * the signal.
 */
export async function waitForHydration(page: Page, selector = '#username') {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return !!el && Object.keys(el).some((k) => k.startsWith('__react'));
    },
    selector,
    { timeout: 45_000 },
  );
}

/**
 * Fill and submit the login form. Returns the URL the app settled on.
 *
 * `expect: 'failure'` shortens the settle wait: a refused login never leaves
 * /login, so waiting the full success timeout only burns wall-clock.
 */
export async function login(
  page: Page,
  username: string,
  password: string,
  opts: { callbackPath?: string; expect?: 'success' | 'failure' } = {},
): Promise<string> {
  const url = opts.callbackPath ? `/login?callbackUrl=${encodeURIComponent(opts.callbackPath)}` : '/login';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForHydration(page, '#username');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('form button[type="submit"]').first().click();
  await page
    .waitForURL((u) => !u.pathname.includes('/login'), { timeout: opts.expect === 'failure' ? 8_000 : 90_000 })
    .catch(() => {
      /* caller asserts — a refused login legitimately stays on /login */
    });
  await page.waitForLoadState('domcontentloaded');
  return page.url();
}

export async function loginExpectingSuccess(page: Page, username: string, password: string, callbackPath?: string) {
  const settled = await login(page, username, password, { callbackPath });
  expect(settled, `login as ${username} should leave /login`).not.toContain('/login');
  await expectRendered(page, `landing page for ${username}`);
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}

/**
 * Select the active branch, exactly as the branch switcher does.
 *
 * `switchActiveBranch` writes the `active_branch_id` cookie and nothing else,
 * and `getActiveBranchId()` reads it back, so setting the cookie is the same
 * operation without paying for a dropdown round-trip in every scoping test.
 * Pass 'all' for the All Branches selection (a null scope, not an exemption).
 */
export async function setActiveBranch(page: Page, branchId: string | 'all') {
  // Set it by URL, not by domain: a domain-scoped cookie sits alongside the
  // host-only one the server writes, and the stale copy wins the read.
  await page.context().addCookies([
    {
      name: 'active_branch_id',
      value: branchId,
      url: BASE_URL,
      httpOnly: true,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    },
  ]);
}

/** The active branch as the server would read it. */
export async function activeBranchCookie(page: Page): Promise<string | null> {
  const cookies = await page.context().cookies(BASE_URL);
  return cookies.find((c) => c.name === 'active_branch_id')?.value ?? null;
}

/** A page that renders its shell but no content is a failure we must not pass. */
export async function expectRendered(page: Page, label: string) {
  await page.waitForLoadState('domcontentloaded');
  const text = (await page.locator('body').innerText({ timeout: 15_000 }).catch(() => '')).trim();
  expect(text.length, `${label} should not be blank`).toBeGreaterThan(20);
  expect(text, `${label} should not show a server error`).not.toMatch(
    /internal server error|application error|runtime error|unhandled runtime/i,
  );
}

export async function gotoOk(page: Page, path: string, label: string) {
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(res?.status() ?? 200, `${label} should not 5xx`).toBeLessThan(500);
  await expectRendered(page, label);
  return res;
}

/** Body text of a page, lowercased — cheap way to assert presence/absence of a row. */
export async function bodyText(page: Page): Promise<string> {
  return (await page.locator('body').innerText({ timeout: 15_000 }).catch(() => '')).toLowerCase();
}
