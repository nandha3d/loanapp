import { test, expect, type Page } from '@playwright/test';

/**
 * Crawls same-origin pages starting from the public marketing routes (and,
 * if E2E_TEST_EMAIL/E2E_TEST_PASSWORD are set, the dashboard too) and checks
 * every <a href> it finds. Internal dead links fail the test. External dead
 * links are reported but don't fail — third-party uptime isn't ours to
 * block a push over.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const MAX_PAGES = Number(process.env.LINK_CHECK_MAX_PAGES || 150);
const SKIP_SCHEMES = /^(mailto:|tel:|javascript:|#)/i;

async function login(page: Page) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) return false;
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForLoadState('networkidle').catch(() => {});
  return true;
}

function isSameOrigin(url: string) {
  try {
    return new URL(url).origin === new URL(BASE_URL).origin;
  } catch {
    return false;
  }
}

test('no dead links reachable from the app', async ({ page }) => {
  const visited = new Set<string>();
  const queue: string[] = [`${BASE_URL}/`];
  const checkedLinks = new Map<string, number | 'error'>();
  const deadInternal: string[] = [];
  const deadExternal: string[] = [];

  const authed = await login(page);
  if (authed) queue.push(`${BASE_URL}/dashboard`);

  while (queue.length && visited.size < MAX_PAGES) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    const resp = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null);
    if (!resp) continue;

    const hrefs = await page.$$eval('a[href]', (els) => els.map((el) => el.getAttribute('href') || ''));
    for (const raw of hrefs) {
      if (!raw || SKIP_SCHEMES.test(raw)) continue;
      let absolute: string;
      try {
        absolute = new URL(raw, url).toString();
      } catch {
        continue;
      }

      if (isSameOrigin(absolute) && !visited.has(absolute) && !queue.includes(absolute)) {
        queue.push(absolute);
      }

      if (checkedLinks.has(absolute)) continue;
      try {
        const linkResp = await page.request.fetch(absolute, { method: 'HEAD', failOnStatusCode: false });
        const status = linkResp.status() === 405
          ? (await page.request.fetch(absolute, { method: 'GET', failOnStatusCode: false })).status()
          : linkResp.status();
        checkedLinks.set(absolute, status);
        if (status >= 400) {
          (isSameOrigin(absolute) ? deadInternal : deadExternal).push(`${absolute} (${status}) found on ${url}`);
        }
      } catch {
        checkedLinks.set(absolute, 'error');
        (isSameOrigin(absolute) ? deadInternal : deadExternal).push(`${absolute} (request failed) found on ${url}`);
      }
    }
  }

  if (deadExternal.length) {
    console.warn(`[link-check] ${deadExternal.length} external link(s) returned errors (not failing the build):\n${deadExternal.join('\n')}`);
  }

  expect(deadInternal, `Dead internal links:\n${deadInternal.join('\n')}`).toEqual([]);
});
