import { expect, test } from '@playwright/test';
import { expectAppShell, expectOneOfText, gotoModule } from './helpers';

test.describe('WEB-ANALYTICS analytics module', () => {
  test('WEB-ANALYTICS-001 analytics page loads with dashboard/report content', async ({ page }) => {
    const response = await gotoModule(page, '/analytics');
    expect(response?.status()).toBeLessThan(500);
    await expectAppShell(page);
    await expectOneOfText(page, [/Analytics/i, /Reports/i, /Portfolio/i, /Collection/i]);
  });
});
