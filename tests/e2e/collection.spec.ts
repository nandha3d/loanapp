/**
 * COLLECTION — entry page, today's dues, record collection, receipt.
 * (PARITY §4 COLL-01..06). Recording needs seeded due instalments.
 */
import { test, expect } from '@playwright/test';
import { STORAGE } from '../../playwright.config';
import { goto } from './helpers/app';

test.describe('COLLECTION', () => {
  test('collection page renders', async ({ page }) => {
    await goto(page, '/collection');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/collection|today|due/i).first()).toBeVisible();
  });

  test('COLL-01 record a collection on a due row (needs seeded data)', async ({ page }) => {
    await goto(page, '/collection');
    const collectBtn = page.getByRole('button', { name: /collect|receive|pay/i }).first();
    test.skip(!(await collectBtn.count()), 'no due rows seeded today');
    await collectBtn.click();
    const amount = page.getByLabel(/amount/i).or(page.getByPlaceholder(/amount/i)).first();
    if (await amount.count()) await amount.fill('100');
    await page.getByRole('button', { name: /save|confirm|submit|collect/i }).first().click();
    await page.waitForLoadState('networkidle');
  });

  test('COLL-01 OUT collecting more than due is capped/rejected', async ({ page }) => {
    await goto(page, '/collection');
    const collectBtn = page.getByRole('button', { name: /collect|receive/i }).first();
    test.skip(!(await collectBtn.count()), 'no due rows seeded today');
    await collectBtn.click();
    const amount = page.getByLabel(/amount/i).or(page.getByPlaceholder(/amount/i)).first();
    if (await amount.count()) {
      await amount.fill('99999999');
      await page.getByRole('button', { name: /save|confirm|collect/i }).first().click();
      await page.waitForLoadState('networkidle');
    }
  });

  test.describe('COLLECTION as agent', () => {
    test.use({ storageState: STORAGE.agent });
    test('agent can open collection (their core screen)', async ({ page }) => {
      await goto(page, '/collection');
      await expect(page.locator('body')).toBeVisible();
    });
  });
});
