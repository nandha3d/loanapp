import { expect, Page } from '@playwright/test';

export const MODULE = process.env.TEST_MODULE ?? 'microlending';
export const BASE = `/${MODULE}`;

export function moduleRoute(path: string) {
  return `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function gotoModule(page: Page, path: string) {
  const response = await page.goto(moduleRoute(path), { waitUntil: 'domcontentloaded' });
  return response;
}

export async function expectAppShell(page: Page) {
  await expect(page.locator('body')).toBeVisible();
  await expect(page).not.toHaveURL(/\/login$/);
}

export async function expectOneOfText(page: Page, patterns: RegExp[]) {
  const body = await page.locator('body').innerText();
  expect(
    patterns.some((pattern) => pattern.test(body)),
    `Expected one of ${patterns.map(String).join(', ')} in page body`,
  ).toBeTruthy();
}
