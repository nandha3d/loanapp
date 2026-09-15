import { expect, test } from '@playwright/test';
import { expectAppShell, expectOneOfText, gotoModule, moduleRoute } from './helpers';

test.describe('WEB-VEH vehicles module', () => {
  test('WEB-VEH-001 vehicle registry loads or shows module gate', async ({ page }) => {
    const response = await gotoModule(page, '/vehicles');
    expect(response?.status()).toBeLessThan(500);
    await expectAppShell(page);
    await expectOneOfText(page, [/Vehicle/i, /Auto Finance/i, /Module Not Enabled/i]);
  });

  test('WEB-VEH-002 add vehicle route loads without server error', async ({ page }) => {
    const response = await page.goto(moduleRoute('/vehicles/new'), { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
    await expectAppShell(page);
  });
});
