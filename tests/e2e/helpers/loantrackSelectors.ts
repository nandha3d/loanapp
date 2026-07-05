import { expect, type Locator, type Page } from '@playwright/test';

export const MODULE = process.env.TEST_MODULE || 'microlending';

export function modulePath(subPath: string) {
  const suffix = subPath.startsWith('/') ? subPath : `/${subPath}`;
  return `/${MODULE}${suffix}`;
}

export function loginUsername(page: Page): Locator {
  return page.getByLabel(/username|phone|email/i).first();
}

export function loginPassword(page: Page): Locator {
  return page.getByLabel(/password/i).first();
}

export function loginSubmit(page: Page): Locator {
  return page.getByRole('button', { name: /sign in|log ?in/i }).first();
}

export async function expectLoginForm(page: Page) {
  await expect(loginUsername(page)).toBeVisible();
  await expect(loginPassword(page)).toBeVisible();
  await expect(loginSubmit(page)).toBeVisible();
}

export async function loginAs(page: Page, credentials: {
  username: string;
  password: string;
  callbackPath: string;
}) {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(credentials.callbackPath)}`);
  await expectLoginForm(page);
  await loginUsername(page).fill(credentials.username);
  await loginPassword(page).fill(credentials.password);
  await loginSubmit(page).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 });
  await expectNonBlankAppPage(page, `landing page for ${credentials.username}`);
}

export async function expectNonBlankAppPage(page: Page, label: string) {
  await page.waitForLoadState('domcontentloaded');
  const body = page.locator('body');
  await expect(body, `${label} body should render`).toBeVisible();
  const text = (await body.innerText({ timeout: 10_000 }).catch(() => '')).trim();
  expect(text.length, `${label} should not be blank`).toBeGreaterThan(20);
  expect(text, `${label} should not show a server error`).not.toMatch(
    /internal server error|application error|runtime error|this page could not be found|500\b/i,
  );
}

export function menuLink(page: Page, names: Array<string | RegExp>): Locator {
  const links = names.map((name) => page.getByRole('link', { name }));
  return links.reduce((combined, locator) => combined.or(locator));
}

export async function expectAnyVisible(label: string, locators: Locator[]) {
  for (const locator of locators) {
    if (await locator.first().isVisible().catch(() => false)) return;
  }
  throw new Error(`Expected at least one visible selector for ${label}.`);
}

export async function expectRouteLoads(page: Page, path: string, label: string) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response?.status() ?? 200, `${label} should not return 500`).toBeLessThan(500);
  await expectNonBlankAppPage(page, label);
}

export async function expectRunText(page: Page, text: string) {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
}
