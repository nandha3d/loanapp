import { expect, test } from '@playwright/test';
import path from 'path';
import { expectAppShell, expectOneOfText, gotoModule } from './helpers';

test.describe('WEB-AFF-SUB affiliate and subscription', () => {
  test('WEB-SUB-001 subscription page loads for tenant admin role', async ({ page }) => {
    const response = await gotoModule(page, '/subscription');
    expect(response?.status()).toBeLessThan(500);
    await expectAppShell(page);
    await expectOneOfText(page, [/Subscription/i, /Billing/i, /Plan/i, /Module/i]);
  });

  test('WEB-AFF-001 affiliate page loads for tenant role', async ({ page }) => {
    const response = await gotoModule(page, '/affiliate');
    expect(response?.status()).toBeLessThan(500);
    await expectAppShell(page);
    await expectOneOfText(page, [/Affiliate/i, /Referral/i, /Reward/i, /Partner/i]);
  });

  test('WEB-AFF-002 developer affiliate admin route loads', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(process.cwd(), 'playwright/.auth/developer.json'),
    });
    const page = await context.newPage();
    const response = await page.goto('/admin/affiliates', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    await context.close();
  });
});
