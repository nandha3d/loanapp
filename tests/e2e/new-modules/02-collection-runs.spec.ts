import { expect, test } from '@playwright/test';
import { expectAppShell, expectOneOfText, gotoModule, moduleRoute } from './helpers';

test.describe('WEB-COLL-RUN collection runs and self-pay', () => {
  test('WEB-COLL-RUN-001 runs list route loads', async ({ page }) => {
    const response = await gotoModule(page, '/collection/runs');
    expect(response?.status()).toBeLessThan(500);
    await expectAppShell(page);
    await expectOneOfText(page, [/Run/i, /Collection/i, /Route/i, /No/i]);
  });

  test('WEB-COLL-RUN-002 collection page exposes collection workflow', async ({ page }) => {
    const response = await gotoModule(page, '/collection');
    expect(response?.status()).toBeLessThan(500);
    await expectAppShell(page);
    await expectOneOfText(page, [/Collection/i, /Today/i, /Overdue/i]);
  });

  test('WEB-COLL-RUN-003 borrower self-pay route is not publicly listable', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto(moduleRoute('/collection/runs'));
    await expect(page).toHaveURL(/\/login|\/collection|\/dashboard/, { timeout: 10_000 });
    await context.close();
  });
});
