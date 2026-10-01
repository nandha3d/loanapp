import { test, expect } from '@playwright/test';
import path from 'node:path';

const htmlReportUrl = `file:///${path.resolve('docs/audit-parity-verification-report.html').replace(/\\/g, '/')}`;

test.describe('Audit Verification Report UI Check', () => {
  test('HTML report renders with 29 confirmed findings and working filters', async ({ page }) => {
    // 1. Navigate to the generated HTML report
    await page.goto(htmlReportUrl);
    await expect(page).toHaveTitle(/ZoloFund Audit Verification Report/);

    // 2. Verify header & metrics banner
    const header = page.locator('header.header');
    await expect(header).toBeVisible();
    await expect(header.getByText('Subagent Bug Verification & Parity Audit Matrix')).toBeVisible();

    // 3. Verify stats cards
    const confirmedCount = page.locator('.stat-card.danger .num').first();
    await expect(confirmedCount).toHaveText('29');

    // 4. Verify all 29 finding cards are rendered
    const cards = page.locator('.finding-card');
    await expect(cards).toHaveCount(29);

    // 5. Test category filtering: Customers
    await page.getByRole('button', { name: /1\. Customers/i }).click();
    const visibleCustomerCards = page.locator('.finding-card:visible');
    await expect(visibleCustomerCards).toHaveCount(9);

    // 6. Test category filtering: Loans
    await page.getByRole('button', { name: /2\. Loans/i }).click();
    const visibleLoanCards = page.locator('.finding-card:visible');
    await expect(visibleLoanCards).toHaveCount(5);

    // 7. Test category filtering: Wallet
    await page.getByRole('button', { name: /3\. Wallet/i }).click();
    const visibleWalletCards = page.locator('.finding-card:visible');
    await expect(visibleWalletCards).toHaveCount(5);

    // 8. Test category filtering: Penalties
    await page.getByRole('button', { name: /4\. Penalties/i }).click();
    const visiblePenaltyCards = page.locator('.finding-card:visible');
    await expect(visiblePenaltyCards).toHaveCount(4);

    // 9. Test category filtering: Collection Runs
    await page.getByRole('button', { name: /5\. Collection Runs/i }).click();
    const visibleRunsCards = page.locator('.finding-card:visible');
    await expect(visibleRunsCards).toHaveCount(6);

    // 10. Reset filter to ALL
    await page.getByRole('button', { name: /All Findings/i }).click();
    await expect(page.locator('.finding-card:visible')).toHaveCount(29);

    // 11. Test accordion expand/collapse
    const firstCardHeader = page.locator('.finding-header').first();
    const firstCardBody = page.locator('.finding-body').first();
    await expect(firstCardBody).toBeVisible();
    await firstCardHeader.click();
    await expect(firstCardBody).toBeHidden();
    await firstCardHeader.click();
    await expect(firstCardBody).toBeVisible();

    // 12. Capture full-page screenshot of the audit verification report
    await page.screenshot({ path: 'test-report/audit-verification-report.png', fullPage: true });
  });
});
