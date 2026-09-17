/**
 * AUTH — login, logout, session, RBAC guards. (PARITY §4 AUTH-01..06)
 */
import { test, expect } from '@playwright/test';
import { STORAGE } from '../../playwright.config';
import { m, anonPage } from './helpers/app';

test.describe('AUTH', () => {
  test('AUTH-01 login page renders required elements', async ({ browser }) => {
    const { page, ctx } = await anonPage(browser);
    await page.goto('/login');
    await expect(page.getByLabel(/username|phone|email/i).first()).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|log ?in/i })).toBeVisible();
    await ctx.close();
  });

  test('AUTH-01 OUT wrong password rejected, no session', async ({ browser }) => {
    const { page, ctx } = await anonPage(browser);
    await page.goto('/login');
    await page.getByLabel(/username|phone|email/i).first().fill('superadmin');
    await page.getByLabel(/password/i).fill('wrong-pass');
    await page.getByRole('button', { name: /sign in|log ?in/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });

  test('AUTH-06 unauthenticated → redirected to login', async ({ browser }) => {
    const { page, ctx } = await anonPage(browser);
    await page.goto(m('/loans'));
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });

  test.describe('AUTH-06 RBAC — agent blocked from admin pages', () => {
    test.use({ storageState: STORAGE.agent });
    for (const sub of ['/loans', '/penalties', '/wallet', '/settings', '/analytics']) {
      test(`agent cannot reach ${sub}`, async ({ page }) => {
        await page.goto(m(sub));
        // middleware redirects agents away from these pages
        await expect(page).not.toHaveURL(new RegExp(`${sub}$`));
      });
    }
  });

  test('AUTH superadmin lands on a dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).not.toHaveURL(/\/login/);
  });
});
