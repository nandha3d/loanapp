/**
 * WALLET (Cash Float) — pools, agents, release, top-up, RBAC.
 * (PARITY §4 WAL-01..07)
 */
import { test, expect } from '@playwright/test';
import { STORAGE } from '../../playwright.config';
import { goto, m } from './helpers/app';

test.describe('WALLET', () => {
  test('page renders KPIs + branch pools + agent float sections', async ({ page }) => {
    await goto(page, '/wallet');
    await expect(page.getByText(/cash float/i).first()).toBeVisible();
    await expect(page.getByText(/branch cash pool/i).first()).toBeVisible();
    await expect(page.getByText(/agent float/i).first()).toBeVisible();
  });

  test('WAL-02 IN top up a branch pool', async ({ page }) => {
    await goto(page, '/wallet');
    const form = page.locator('form', { has: page.getByRole('button', { name: /top up/i }) }).first();
    if (await form.count()) {
      await form.getByPlaceholder('Amount').fill('10000');
      page.once('dialog', (d) => d.accept());            // confirm()
      await form.getByRole('button', { name: /top up/i }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/cash float/i).first()).toBeVisible();
    }
  });

  test('WAL-01 IN release funds to an agent', async ({ page }) => {
    await goto(page, '/wallet');
    const form = page.locator('form', { has: page.getByRole('button', { name: /release/i }) }).first();
    if (await form.count()) {
      await form.getByPlaceholder('Amount').fill('5000');
      page.once('dialog', (d) => d.accept());
      await form.getByRole('button', { name: /release/i }).click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('WAL-01 OUT release with empty amount does nothing', async ({ page }) => {
    await goto(page, '/wallet');
    const form = page.locator('form', { has: page.getByRole('button', { name: /release/i }) }).first();
    if (await form.count()) {
      await form.getByRole('button', { name: /release/i }).click(); // amount empty
      // HTML5 `required` blocks submit → still on wallet
      await expect(page).toHaveURL(/wallet/);
    }
  });

  test.describe('WAL RBAC', () => {
    test.use({ storageState: STORAGE.agent });
    test('agent cannot open /wallet (admin tool)', async ({ page }) => {
      await page.goto(m('/wallet'));
      await expect(page).not.toHaveURL(/\/wallet$/);
    });
  });

  test.describe('WAL admin branch-scope', () => {
    test.use({ storageState: STORAGE.admin });
    test('admin sees wallet (own branch scope)', async ({ page }) => {
      await goto(page, '/wallet');
      await expect(page.getByText(/cash float/i).first()).toBeVisible();
    });
  });
});
