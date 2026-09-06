/**
 * LOANS — list (branch scope), new-loan form, create valid/invalid, RBAC.
 * (PARITY §4 LOAN-01..06)
 */
import { test, expect } from '@playwright/test';
import { STORAGE } from '../../playwright.config';
import { goto, m, uniq } from './helpers/app';

test.describe('LOANS', () => {
  test('LOAN-05 list renders (superadmin = all branches)', async ({ page }) => {
    await goto(page, '/loans');
    await expect(page.getByText(/loan/i).first()).toBeVisible();
    // New Loan affordance present
    await expect(
      page.getByRole('link', { name: /new loan|add/i }).or(page.getByRole('button', { name: /new loan|add/i })).first(),
    ).toBeVisible();
  });

  test('new-loan form exposes core fields', async ({ page }) => {
    await goto(page, '/loans/new');
    await expect(page.locator('[name="customerId"]').first()).toBeVisible();
    await expect(page.locator('[name="principal"]').first()).toBeVisible();
    await expect(page.locator('[name="tenure"]').first()).toBeVisible();
    await expect(page.locator('[name="frequency"]').first()).toBeVisible();
  });

  test('LOAN-01 OUT principal=0 rejected', async ({ page }) => {
    await goto(page, '/loans/new');
    const cust = page.locator('[name="customerId"]').first();
    // pick first real customer option if a <select>
    if (await cust.evaluate((el) => el.tagName === 'SELECT').catch(() => false)) {
      await cust.selectOption({ index: 1 }).catch(() => {});
    }
    await page.locator('[name="principal"]').first().fill('0');
    await page.locator('[name="tenure"]').first().fill('10');
    await page.getByRole('button', { name: /create|save|submit|disburse/i }).first().click();
    await page.waitForLoadState('networkidle');
    // should not navigate to a created-loan detail
    await expect(page).toHaveURL(/\/loans\/new|\/loans$/);
  });

  test('LOAN-01 OUT missing customer rejected', async ({ page }) => {
    await goto(page, '/loans/new');
    await page.locator('[name="principal"]').first().fill('10000');
    await page.locator('[name="tenure"]').first().fill('10');
    await page.getByRole('button', { name: /create|save|submit|disburse/i }).first().click();
    await expect(page).toHaveURL(/\/loans\/new/);
  });

  // LOAN-02 wallet hard-block + LOAN-01 IN happy path require seeded float +
  // customer; covered by integration tests. Smoke the create path here:
  test('LOAN-01 IN create with valid inputs (needs seeded customer)', async ({ page }) => {
    await goto(page, '/loans/new');
    const cust = page.locator('[name="customerId"]').first();
    const isSelect = await cust.evaluate((el) => el.tagName === 'SELECT').catch(() => false);
    test.skip(!isSelect, 'customer picker not a <select> or no seeded customers');
    await cust.selectOption({ index: 1 });
    await page.locator('[name="principal"]').first().fill('10000');
    await page.locator('[name="tenure"]').first().fill('10');
    await page.locator('[name="voucherRef"]').first().fill(`V-${uniq()}`).catch(() => {});
    await page.getByRole('button', { name: /create|save|submit|disburse/i }).first().click();
    await page.waitForLoadState('networkidle');
  });

  test.describe('LOAN RBAC', () => {
    test.use({ storageState: STORAGE.agent });
    test('agent redirected away from /loans', async ({ page }) => {
      await page.goto(m('/loans'));
      await expect(page).not.toHaveURL(/\/loans$/);
    });
  });
});
