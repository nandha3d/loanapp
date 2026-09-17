/**
 * SUPERADMIN / DEVELOPER surfaces: subscription, affiliate, branch/module
 * requests, admin panel (users/team/branches), borrower portal smoke.
 * (PARITY §4 SUB-01, AFF-01, ADM-01/02, BOR-01)
 */
import { test, expect } from '@playwright/test';
import { STORAGE } from '../../playwright.config';
import { goto, anonPage } from './helpers/app';

test.describe('SUBSCRIPTION & AFFILIATE (superadmin)', () => {
  test('subscription page renders', async ({ page }) => {
    await goto(page, '/subscription');
    await expect(page.locator('body')).toBeVisible();
  });
  test('affiliate program page renders', async ({ page }) => {
    await goto(page, '/affiliate');
    await expect(page.locator('body')).toBeVisible();
  });
  test('branch-requests + module-requests render', async ({ page }) => {
    await goto(page, '/branch-requests');
    await expect(page.locator('body')).toBeVisible();
    await goto(page, '/module-requests');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('ADMIN PANEL', () => {
  test('ADM-01 users + team + branches render', async ({ page }) => {
    for (const url of ['/admin/users', '/admin/team', '/admin/branches']) {
      const res = await page.goto(url);
      // superadmin may be scoped; assert no hard error page
      expect([200, 302, 307].includes(res?.status() ?? 200)).toBeTruthy();
    }
  });
});

test.describe('AFFILIATE public', () => {
  test('AFF-01 public affiliate landing renders', async ({ browser }) => {
    const { page, ctx } = await anonPage(browser);
    const res = await page.goto('/affiliate');
    expect(res?.status()).toBeLessThan(500);
    await ctx.close();
  });
});

test.describe('BORROWER PORTAL', () => {
  test('BOR-01 borrower login page renders', async ({ browser }) => {
    const { page, ctx } = await anonPage(browser);
    await page.goto('/borrower/login');
    await expect(page.locator('body')).toBeVisible();
    await ctx.close();
  });

  test('BOR-01 OUT borrower dashboard requires auth', async ({ browser }) => {
    const { page, ctx } = await anonPage(browser);
    await page.goto('/borrower/dashboard');
    await expect(page).toHaveURL(/borrower\/login|login/);
    await ctx.close();
  });
});

test.describe('DEVELOPER billing (RBAC)', () => {
  test.use({ storageState: STORAGE.admin });
  test('admin cannot reach developer billing', async ({ page }) => {
    const res = await page.goto('/admin/billing');
    // redirected or forbidden, not a 200 billing page for a plain admin
    expect(page.url()).not.toMatch(/\/admin\/billing$/);
    expect(res?.status() ?? 0).toBeLessThan(500);
  });
});
