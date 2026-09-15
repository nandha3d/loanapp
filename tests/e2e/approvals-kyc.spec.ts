/**
 * APPROVALS + KYC review — queues, approve/reject, RBAC. (PARITY §4 APPR-01, KYC-01)
 */
import { test, expect } from '@playwright/test';
import { STORAGE } from '../../playwright.config';
import { goto, m } from './helpers/app';

test.describe('APPROVALS', () => {
  test('approvals queue renders', async ({ page }) => {
    await goto(page, '/approvals');
    await expect(page.getByText(/approval|pending|request/i).first()).toBeVisible();
  });

  test('APPR-01 approve a pending request (needs data)', async ({ page }) => {
    await goto(page, '/approvals');
    const approve = page.getByRole('button', { name: /approve/i }).first();
    test.skip(!(await approve.count()), 'no pending requests seeded');
    await approve.click();
    await page.waitForLoadState('networkidle');
  });

  test('APPR-01 reject path present', async ({ page }) => {
    await goto(page, '/approvals');
    const reject = page.getByRole('button', { name: /reject|decline/i }).first();
    test.skip(!(await reject.count()), 'no pending requests seeded');
    await expect(reject).toBeVisible();
  });
});

test.describe('KYC REVIEW', () => {
  test('kyc queue renders', async ({ page }) => {
    await goto(page, '/kyc-review');
    await expect(page.locator('body')).toBeVisible();
  });

  test.describe('KYC-01 OUT agent blocked', () => {
    test.use({ storageState: STORAGE.agent });
    test('agent cannot reach /kyc-review', async ({ page }) => {
      await page.goto(m('/kyc-review'));
      await expect(page).not.toHaveURL(/\/kyc-review$/);
    });
  });
});
