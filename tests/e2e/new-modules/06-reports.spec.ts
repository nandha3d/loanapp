import { expect, test } from '@playwright/test';
import { expectAppShell, expectOneOfText, gotoModule } from './helpers';

test.describe('WEB-REPORT reports module', () => {
  test('WEB-REPORT-001 reports page loads and exposes report content', async ({ page }) => {
    const response = await gotoModule(page, '/reports');
    expect(response?.status()).toBeLessThan(500);
    await expectAppShell(page);
    await expectOneOfText(page, [/Report/i, /Collection/i, /Aging/i, /Agent/i]);
  });

  test('WEB-REPORT-002 agent reports route loads without server error', async ({ page }) => {
    const response = await gotoModule(page, '/reports/agents');
    expect(response?.status()).toBeLessThan(500);
    await expectAppShell(page);
  });
});
