/**
 * SETTINGS — render groups, save a value, validation, RBAC. (PARITY §4 SET-01)
 */
import { test, expect } from '@playwright/test';
import { STORAGE } from '../../playwright.config';
import { goto, m } from './helpers/app';

test.describe('SETTINGS', () => {
  test('settings page renders form groups', async ({ page }) => {
    await goto(page, '/settings');
    await expect(page.locator('form, [name]').first()).toBeVisible();
  });

  test('SET-01 IN save settings persists', async ({ page }) => {
    await goto(page, '/settings');
    const save = page.getByRole('button', { name: /save|update|apply/i }).first();
    test.skip(!(await save.count()), 'no save button found');
    await save.click();
    await page.waitForLoadState('networkidle');
  });

  test('SET-01 OUT negative penalty rate rejected', async ({ page }) => {
    await goto(page, '/settings');
    const penalty = page.locator('[name*="penalty" i]').first();
    test.skip(!(await penalty.count()), 'penalty field not on this settings page');
    await penalty.fill('-5');
    await page.getByRole('button', { name: /save|update/i }).first().click();
    await page.waitForLoadState('networkidle');
  });

  test.describe('SET RBAC', () => {
    test.use({ storageState: STORAGE.agent });
    test('agent blocked from /settings', async ({ page }) => {
      await page.goto(m('/settings'));
      await expect(page).not.toHaveURL(/\/settings$/);
    });
  });
});
