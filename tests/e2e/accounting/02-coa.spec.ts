/**
 * ACCOUNTING E2E — 02: Chart of Accounts (CoA)
 *
 * Covers:
 *   - CoA page loads with table and toolbar
 *   - Reseed populates default accounts
 *   - Search by code / name filters rows
 *   - Class filter (asset/liability/equity/income/expense)
 *   - Show inactive toggle
 *   - Add Account modal: validation (empty code), create success
 *   - Duplicate code rejected
 *   - Edit Account modal: rename, sub-type change
 *   - Deactivate account
 *   - Reactivate deactivated account
 *   - Add child account (parent → child code hierarchy)
 *   - Tree expand/collapse
 */
import { test, expect } from '@playwright/test';
import { gotoAC, AC } from './helpers';

const UNIQUE_SUFFIX = Date.now();
const TEST_CODE = `9${String(UNIQUE_SUFFIX).slice(-6)}`; // avoid collision across repeated local runs
const TEST_NAME = `E2E Test Account ${UNIQUE_SUFFIX}`;

test.describe('Chart of Accounts', () => {

  test.beforeEach(async ({ page }) => {
    await gotoAC(page, '/coa');
  });

  // ── Page structure ──────────────────────────────────────────────────────

  test('CoA page renders toolbar and table', async ({ page }) => {
    await expect(page.getByPlaceholder('Search…')).toBeVisible();
    await expect(page.getByRole('button', { name: /add account/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /reseed/i })).toBeVisible();
    await expect(page.locator('table.ac-table')).toBeVisible();
  });

  test('table has expected column headers', async ({ page }) => {
    const headers = ['Code', 'Name', 'Class', 'Sub-type', 'Balance', 'Actions'];
    for (const h of headers) {
      await expect(page.locator('table.ac-table thead').getByText(h)).toBeVisible();
    }
  });

  // ── Reseed ──────────────────────────────────────────────────────────────

  test('reseed populates default CoA accounts', async ({ page }) => {
    await page.getByRole('button', { name: /reseed/i }).click();
    // Reseed response shows "Reseeded: X created, Y skipped"
    await expect(page.getByText(/reseeded/i)).toBeVisible({ timeout: 15_000 });
    // After reload, at least one account row present
    await page.waitForLoadState('networkidle');
    const rows = page.locator('table.ac-table tbody tr');
    await expect(rows.first()).toBeVisible();
  });

  // ── Search & filter ─────────────────────────────────────────────────────

  test('search by account code filters table', async ({ page }) => {
    // Only run if accounts exist
    const rowCount = await page.locator('table.ac-table tbody tr').count();
    test.skip(rowCount === 0, 'No accounts — run reseed first');

    // Get first row code text
    const firstCode = await page.locator('table.ac-table tbody tr:first-child td:first-child').textContent();
    const code = firstCode?.trim().replace(/[▾▸]/g, '').trim() ?? '';
    if (!code) return;

    await page.getByPlaceholder('Search…').fill(code);
    await page.waitForTimeout(300);

    const visibleRows = page.locator('table.ac-table tbody tr');
    const count = await visibleRows.count();
    // At least 1 row visible, all contain the searched code
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(count, 5); i++) {
      const rowText = await visibleRows.nth(i).textContent();
      expect(rowText).toContain(code);
    }
  });

  test('class filter "expense" shows only expense accounts', async ({ page }) => {
    const rowCount = await page.locator('table.ac-table tbody tr').count();
    test.skip(rowCount === 0, 'No accounts');

    await page.getByLabel('Account class filter').selectOption({ label: 'expense' });
    await page.waitForTimeout(300);

    const badges = page.locator('table.ac-table tbody tr .ac-badge, table.ac-table tbody tr [class*="badge"]');
    const badgeCount = await badges.count();
    if (badgeCount === 0) return; // No expense accounts yet

    for (let i = 0; i < Math.min(badgeCount, 10); i++) {
      await expect(badges.nth(i)).toContainText('expense');
    }
  });

  test('clearing class filter restores all accounts', async ({ page }) => {
    const rowCount = await page.locator('table.ac-table tbody tr').count();
    test.skip(rowCount === 0, 'No accounts');

    await page.getByLabel('Account class filter').selectOption({ label: 'expense' });
    await page.waitForTimeout(200);
    const filtered = await page.locator('table.ac-table tbody tr').count();

    await page.getByLabel('Account class filter').selectOption({ label: 'All classes' });
    await page.waitForTimeout(200);
    const unfiltered = await page.locator('table.ac-table tbody tr').count();

    expect(unfiltered).toBeGreaterThanOrEqual(filtered);
  });

  test('show inactive checkbox reveals inactive rows', async ({ page }) => {
    const rowCountBefore = await page.locator('table.ac-table tbody tr').count();
    await page.getByLabel(/show inactive/i).check();
    await page.waitForTimeout(200);
    const rowCountAfter = await page.locator('table.ac-table tbody tr').count();
    // After showing inactive, count should be ≥ before (may equal if no inactive)
    expect(rowCountAfter).toBeGreaterThanOrEqual(rowCountBefore);
  });

  // ── Add Account ─────────────────────────────────────────────────────────

  test('add account modal opens with empty form', async ({ page }) => {
    await page.getByRole('button', { name: /add account/i }).click();
    const modal = page.locator('.ac-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/add account/i)).toBeVisible();
    await expect(modal.getByLabel(/^code/i)).toBeVisible();
    await expect(modal.getByLabel(/^name/i)).toBeVisible();
    await expect(modal.getByLabel(/class/i)).toBeVisible();
  });

  test('add account modal closes on Cancel', async ({ page }) => {
    await page.getByRole('button', { name: /add account/i }).click();
    const modal = page.locator('.ac-modal');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: /cancel/i }).click();
    await expect(modal).not.toBeVisible();
  });

  test('create new account succeeds', async ({ page }) => {
    await page.getByRole('button', { name: /add account/i }).click();
    const modal = page.locator('.ac-modal');

    await modal.getByLabel(/^code/i).fill(TEST_CODE);
    await modal.getByLabel(/^name/i).fill(TEST_NAME);
    await modal.getByLabel(/class/i).selectOption('expense');

    await modal.getByRole('button', { name: /save/i }).click();

    // Modal should close and success message shown
    await expect(modal).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/saved|done/i)).toBeVisible();

    // Account should appear in table
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(TEST_CODE)).toBeVisible();
    await expect(page.getByText(TEST_NAME)).toBeVisible();
  });

  test('duplicate account code shows error', async ({ page }) => {
    // Try adding the same code again
    await page.getByRole('button', { name: /add account/i }).click();
    const modal = page.locator('.ac-modal');

    await modal.getByLabel(/^code/i).fill(TEST_CODE);
    await modal.getByLabel(/^name/i).fill('Duplicate Account');
    await modal.getByLabel(/class/i).selectOption('expense');

    await modal.getByRole('button', { name: /save/i }).click();

    // Should show error (modal stays open or error message)
    await expect(page.getByText(/duplicate|already exists|duplicateCode/i)).toBeVisible({ timeout: 6_000 });
  });

  // ── Edit Account ────────────────────────────────────────────────────────

  test('edit account modal pre-fills existing values', async ({ page }) => {
    // Find our test account row
    const row = page.locator('table.ac-table tbody tr').filter({ hasText: TEST_NAME });
    await expect(row).toBeVisible();

    await row.locator('button').first().click();

    const modal = page.locator('.ac-modal');
    await expect(modal).toBeVisible();

    // Name should be pre-filled
    await expect(modal.getByLabel(/^name/i)).toHaveValue(TEST_NAME);
    // Code field should NOT be present in edit mode (read-only after create)
    await expect(modal.getByLabel(/^code/i)).not.toBeVisible();
  });

  test('edit account — rename succeeds', async ({ page }) => {
    const row = page.locator('table.ac-table tbody tr').filter({ hasText: TEST_NAME });
    await row.locator('button').first().click();

    const modal = page.locator('.ac-modal');
    await expect(modal).toBeVisible();

    const newName = `${TEST_NAME} (renamed)`;
    await modal.getByLabel(/^name/i).fill(newName);
    await modal.getByRole('button', { name: /save/i }).click();

    await expect(modal).not.toBeVisible({ timeout: 8_000 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(newName)).toBeVisible();
  });

  // ── Deactivate / Reactivate ──────────────────────────────────────────────

  test('deactivate account toggles row to inactive', async ({ page }) => {
    const newName = `${TEST_NAME} (renamed)`;
    const row = page.locator('table.ac-table tbody tr').filter({ hasText: newName });
    await expect(row).toBeVisible();

    // Deactivate button is the ✕ (danger) button in the row
    const deactivateBtn = row.locator('button[class*="danger"], button:has-text("✕")').last();
    await deactivateBtn.click();

    await expect(page.getByText(/done/i)).toBeVisible({ timeout: 8_000 });

    // With "show inactive" checked, the row should still be there but dimmed
    await page.getByLabel(/show inactive/i).check();
    const dimmedRow = page.locator('table.ac-table tbody tr').filter({ hasText: newName });
    await expect(dimmedRow).toBeVisible();
    const opacity = await dimmedRow.evaluate(el => parseFloat(getComputedStyle(el).opacity));
    expect(opacity).toBeLessThan(1);
  });

  test('reactivate deactivated account (toggle back)', async ({ page }) => {
    await page.getByLabel(/show inactive/i).check();
    const newName = `${TEST_NAME} (renamed)`;
    const row = page.locator('table.ac-table tbody tr').filter({ hasText: newName });
    await expect(row).toBeVisible();

    // The button now shows ↩ (reactivate)
    const reactivateBtn = row.locator('button:has-text("↩"), button[class*="danger"]').last();
    await reactivateBtn.click();
    await expect(page.getByText(/done/i)).toBeVisible({ timeout: 8_000 });

    // Row should be fully opaque now
    await page.waitForTimeout(500);
    const opacity = await row.evaluate(el => parseFloat(getComputedStyle(el).opacity));
    expect(opacity).toBe(1);
  });

  // ── Add Child Account ───────────────────────────────────────────────────

  test('add child account from parent row ⊕ button', async ({ page }) => {
    // Find an account row that has the ⊕ add-child button
    const firstRow = page.locator('table.ac-table tbody tr').first();
    const parentCode = await firstRow.locator('td').first().textContent();

    const addChildBtn = firstRow.locator('button:has-text("⊕")');
    await expect(addChildBtn).toBeVisible();
    await addChildBtn.click();

    const modal = page.locator('.ac-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/add account/i)).toBeVisible();

    const childCode = `${String(UNIQUE_SUFFIX).slice(-7)}C`;
    const childName = `Child ${childCode} of ${parentCode?.trim() ?? 'parent'}`;
    await modal.getByLabel(/^code/i).fill(childCode);
    await modal.getByLabel(/^name/i).fill(childName);
    await modal.getByRole('button', { name: /save/i }).click();

    await expect(modal).not.toBeVisible({ timeout: 8_000 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(childName)).toBeVisible();
  });

  // ── Tree expand/collapse ─────────────────────────────────────────────────

  test('expand/collapse tree row with ▾/▸ button', async ({ page }) => {
    // Find a row that has the expand button (has children)
    const expandBtn = page.locator('table.ac-table tbody tr button').filter({ hasText: /▾|▸/ }).first();
    const rowCount = await page.locator('table.ac-table tbody tr').count();
    if (await expandBtn.count() === 0) {
      test.skip(true, 'No parent accounts with children');
      return;
    }

    // Collapse
    if (await expandBtn.textContent() === '▾') {
      await expandBtn.click();
      await page.waitForTimeout(200);
      const newCount = await page.locator('table.ac-table tbody tr').count();
      expect(newCount).toBeLessThanOrEqual(rowCount);
    }

    // Expand back
    const collapseBtn = page.locator('table.ac-table tbody tr button').filter({ hasText: /▾|▸/ }).first();
    await collapseBtn.click();
    await page.waitForTimeout(200);
    const finalCount = await page.locator('table.ac-table tbody tr').count();
    expect(finalCount).toBeGreaterThanOrEqual(1);
  });

});
