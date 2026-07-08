import { expect, test } from '@playwright/test';
import { expectAppShell, expectOneOfText, gotoModule, moduleRoute } from './helpers';

function skipIfAuthStateMissing(url: string) {
  if (new URL(url).pathname.endsWith('/login')) {
    test.skip(true, 'Authenticated storage state is missing or stale; only unauthenticated redirect smoke can run.');
  }
}

test.describe('WEB-CHIT chits module', () => {
  test('WEB-CHIT-001 list page loads or shows subscription gate', async ({ page }) => {
    const response = await gotoModule(page, '/chits');
    expect(response?.status()).toBeLessThan(500);
    skipIfAuthStateMissing(page.url());
    await expectAppShell(page);
    await expectOneOfText(page, [/Chit/i, /Module Not Enabled/i, /subscription/i]);
  });

  test('WEB-CHIT-002 new group route is protected by auth and shell', async ({ page }) => {
    const response = await page.goto(moduleRoute('/chits/new'), { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
    skipIfAuthStateMissing(page.url());
    await expectAppShell(page);
  });

  test('WEB-CHIT-003 unauthenticated access redirects to login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto(moduleRoute('/chits'));
    await expect(page).toHaveURL(/\/login|\/collection|\/dashboard/, { timeout: 10_000 });
    await context.close();
  });
});
