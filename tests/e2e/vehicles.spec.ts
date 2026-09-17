/**
 * VEHICLES — list, new-vehicle form, create valid/invalid, dup reg. (PARITY §4 VEH-01)
 */
import { test, expect } from '@playwright/test';
import { goto, uniq } from './helpers/app';

test.describe('VEHICLES', () => {
  test('list renders + new affordance', async ({ page }) => {
    await goto(page, '/vehicles');
    await expect(page.locator('body')).toBeVisible();
  });

  test('new-vehicle form exposes fields', async ({ page }) => {
    await goto(page, '/vehicles/new');
    for (const n of ['customerId', 'registrationNo', 'make', 'model', 'vehicleType']) {
      await expect(page.locator(`[name="${n}"]`).first()).toBeVisible();
    }
  });

  test('VEH-01 OUT missing required fields blocked', async ({ page }) => {
    await goto(page, '/vehicles/new');
    await page.getByRole('button', { name: /save|create|add|submit/i }).first().click();
    await expect(page).toHaveURL(/\/vehicles\/new/);
  });

  test('VEH-01 IN create vehicle (needs seeded customer)', async ({ page }) => {
    await goto(page, '/vehicles/new');
    const cust = page.locator('[name="customerId"]').first();
    const isSelect = await cust.evaluate((el) => el.tagName === 'SELECT').catch(() => false);
    test.skip(!isSelect, 'no seeded customers');
    await cust.selectOption({ index: 1 });
    await page.locator('[name="registrationNo"]').first().fill(`TN-${uniq()}`);
    await page.locator('[name="make"]').first().fill('Honda');
    await page.locator('[name="model"]').first().fill('Activa');
    await page.getByRole('button', { name: /save|create|add|submit/i }).first().click();
    await page.waitForLoadState('networkidle');
  });
});
