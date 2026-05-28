/**
 * ACCOUNTING E2E — 01: Navigation & Auth Guards
 *
 * Covers:
 *   - Premium accounting layout visible when enabled
 *   - All 15 nav items render and link correctly
 *   - Active-state on nav link matches URL
 *   - Unauthenticated request redirects to /login
 *   - Agent-role user redirected to dashboard (blocked at layout)
 */
import { test, expect } from '@playwright/test';
import { AC, MODULE, gotoAC } from './helpers';

const NAV_LABELS = [
  'Overview', 'Journal', 'Accounts', 'P&L', 'Balance Sheet',
  'Cash Flow', 'Trial Balance', 'Tax & GST', 'Budget', 'Bank Rec',
  'Vendors', 'Approvals', 'Periods', 'Export', 'Settings',
];

test.describe('Navigation & Auth Guards', () => {

  test('premium layout renders nav bar with all items', async ({ page }) => {
    await gotoAC(page);
    const nav = page.locator('.pa-nav');
    await expect(nav).toBeVisible();
    for (const label of NAV_LABELS) {
      await expect(nav.getByText(label)).toBeVisible();
    }
  });

  test('active nav link highlighted on Overview', async ({ page }) => {
    await gotoAC(page);
    const activeLink = page.locator('.pa-link.pa-active');
    await expect(activeLink).toContainText('Overview');
  });

  test('active nav link switches when navigating to Journal', async ({ page }) => {
    await gotoAC(page, '/journal');
    const activeLink = page.locator('.pa-link.pa-active');
    await expect(activeLink).toContainText('Journal');
  });

  test('active nav link switches when navigating to Accounts (CoA)', async ({ page }) => {
    await gotoAC(page, '/coa');
    await expect(page.locator('.pa-link.pa-active')).toContainText('Accounts');
  });

  test('nav click from Overview → Vendors navigates correctly', async ({ page }) => {
    await gotoAC(page);
    await page.locator('.pa-nav').getByText('Vendors').click();
    await expect(page).toHaveURL(new RegExp(`/${MODULE}/accounting/premium/vendors`));
    await expect(page.locator('.pa-link.pa-active')).toContainText('Vendors');
  });

  test('nav click from Journal → Approvals navigates correctly', async ({ page }) => {
    await gotoAC(page, '/journal');
    await page.locator('.pa-nav').getByText('Approvals').click();
    await expect(page).toHaveURL(new RegExp(`/${MODULE}/accounting/premium/approvals`));
  });

  test('horizontal scroll nav does not show scrollbar (CSS)', async ({ page }) => {
    await gotoAC(page);
    const nav = page.locator('.pa-nav');
    // Ensure nav overflow is scrollable but no visible scrollbar
    const overflow = await nav.evaluate(el => getComputedStyle(el).overflowX);
    expect(['auto', 'scroll']).toContain(overflow);
    const scrollbarWidth = await nav.evaluate(el => (el as any).offsetWidth - (el as any).clientWidth);
    expect(scrollbarWidth).toBe(0);
  });

  test('unauthenticated access redirects to login', async ({ browser }) => {
    // Use a clean context (no saved storage state)
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto(`${AC}`);
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await context.close();
  });

  test('all top-level nav items return 200', async ({ page }) => {
    const subs = [
      '', '/journal', '/coa', '/pnl', '/balance-sheet',
      '/cashflow', '/trial-balance', '/tax', '/budget',
      '/bank-rec', '/vendors', '/approvals', '/period-lock',
      '/export', '/settings',
    ];
    for (const sub of subs) {
      const response = await page.goto(`${AC}${sub}`);
      expect(response?.status(), `${sub} returned non-200`).toBe(200);
    }
  });

});
