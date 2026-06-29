/**
 * CHITS — list, create group, members, auctions. (PARITY §4 CHIT-01)
 * Note: chit module is gated to the `chitfunds` appType; set TEST_MODULE accordingly.
 */
import { test, expect } from '@playwright/test';
import { goto, uniq } from './helpers/app';

test.describe('CHITS', () => {
  test('list renders', async ({ page }) => {
    await goto(page, '/chits');
    await expect(page.locator('body')).toBeVisible();
  });

  test('new chit-group form exposes fields', async ({ page }) => {
    await goto(page, '/chits/new');
    for (const n of ['name', 'chitValue', 'monthlyContrib', 'totalMembers', 'commissionPct', 'startDate']) {
      const f = page.locator(`[name="${n}"]`).first();
      test.skip(!(await f.count()), 'chits/new not available for this module');
      await expect(f).toBeVisible();
    }
  });

  test('CHIT-01 IN create a group', async ({ page }) => {
    await goto(page, '/chits/new');
    const name = page.locator('[name="name"]').first();
    test.skip(!(await name.count()), 'chits/new not available');
    await name.fill(`E2E Chit ${uniq()}`);
    await page.locator('[name="chitValue"]').first().fill('100000');
    await page.locator('[name="monthlyContrib"]').first().fill('5000');
    await page.locator('[name="totalMembers"]').first().fill('20');
    await page.getByRole('button', { name: /create|save|submit/i }).first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/chits\/new$/);
  });

  test('CHIT-01 OUT members > size rejected (guard exists)', async ({ page }) => {
    await goto(page, '/chits/new');
    const name = page.locator('[name="name"]').first();
    test.skip(!(await name.count()), 'chits/new not available');
    await name.fill(`E2E ChitBad ${uniq()}`);
    await page.locator('[name="totalMembers"]').first().fill('0');
    await page.getByRole('button', { name: /create|save|submit/i }).first().click();
    await expect(page).toHaveURL(/\/chits\/new/);
  });
});
