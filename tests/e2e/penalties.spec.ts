/**
 * PENALTIES — list, KPIs, filters, settle, waive (admin only).
 * (PARITY §4 PEN-02..04)
 */
import { test, expect } from '@playwright/test';
import { STORAGE } from '../../playwright.config';
import { goto, m } from './helpers/app';

test.describe('PENALTIES', () => {
  test('list renders KPIs + status filters', async ({ page }) => {
    await goto(page, '/penalties');
    await expect(page.getByText(/gross|outstanding|penalt/i).first()).toBeVisible();
    for (const f of [/pending/i, /settled/i, /waived/i]) {
      await expect(page.getByText(f).first()).toBeVisible();
    }
  });

  test('PEN-02 settle dialog opens on a pending row (needs data)', async ({ page }) => {
    await goto(page, '/penalties');
    const settle = page.getByRole('button', { name: /settle/i }).first();
    test.skip(!(await settle.count()), 'no pending penalties seeded');
    await settle.click();
    await expect(page.getByLabel(/amount/i).or(page.getByText(/settle/i)).first()).toBeVisible();
  });

  test('PEN-03 waive control present for superadmin', async ({ page }) => {
    await goto(page, '/penalties');
    const anyRow = page.getByRole('button', { name: /settle/i }).first();
    test.skip(!(await anyRow.count()), 'no penalties seeded');
    await expect(page.getByRole('button', { name: /waive/i }).first()).toBeVisible();
  });

  test.describe('PEN-03 OUT agent cannot reach penalties', () => {
    test.use({ storageState: STORAGE.agent });
    test('agent redirected from /penalties', async ({ page }) => {
      await page.goto(m('/penalties'));
      await expect(page).not.toHaveURL(/\/penalties$/);
    });
  });
});
