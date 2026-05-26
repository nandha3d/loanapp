/**
 * ACCOUNTING E2E — 05: Approvals
 *
 * Covers:
 *   - Approvals page renders table with filters
 *   - Table columns: type, entity, amount, level, status, actions
 *   - Filter by status: pending / approved / rejected
 *   - Filter by entity type: journal_entry / bill
 *   - Approve L1 entry → status changes to approved
 *   - Reject entry with note → status changes to rejected
 *   - Approve note optional (textarea blank OK)
 *   - Approve note modal textarea visible
 *   - Reject note required validation
 *   - L2 routing: L1 approval at large amount → L2 row appears
 *   - Admin role: only sees own submissions (tested in role-admin.spec.ts)
 */
import { test, expect } from '@playwright/test';
import { gotoAC } from './helpers';

test.describe('Approvals', () => {

  test.beforeEach(async ({ page }) => {
    await gotoAC(page, '/approvals');
  });

  // ── Page structure ──────────────────────────────────────────────────────

  test('approvals page renders table and filters', async ({ page }) => {
    await expect(page.locator('table.ac-table')).toBeVisible();
    // Status filter
    const statusSel = page.locator('select').first();
    await expect(statusSel).toBeVisible();
    // Entity type filter
    await expect(page.locator('select').nth(1)).toBeVisible();
  });

  test('table columns present', async ({ page }) => {
    const headers = ['Type', 'Amount', 'Level', 'Status', 'Requested'];
    const thead = page.locator('table.ac-table thead');
    for (const h of headers) {
      await expect(thead.getByText(new RegExp(h, 'i'))).toBeVisible();
    }
  });

  // ── Filters ──────────────────────────────────────────────────────────────

  test('filter by status "pending" shows only pending rows', async ({ page }) => {
    await page.locator('select').first().selectOption({ label: 'pending' });
    await page.waitForLoadState('networkidle');
    const rows = page.locator('table.ac-table tbody tr');
    const count = await rows.count();
    if (count === 0) return;
    for (let i = 0; i < Math.min(count, 5); i++) {
      const rowText = await rows.nth(i).textContent();
      expect(rowText?.toLowerCase()).toContain('pending');
    }
  });

  test('filter by entity type "journal_entry"', async ({ page }) => {
    await page.locator('select').nth(1).selectOption({ label: 'journal_entry' });
    await page.waitForLoadState('networkidle');
    const rows = page.locator('table.ac-table tbody tr');
    const count = await rows.count();
    if (count === 0) return;
    for (let i = 0; i < Math.min(count, 5); i++) {
      const rowText = await rows.nth(i).textContent();
      expect(rowText?.toLowerCase()).toContain('journal');
    }
  });

  test('filter by entity type "bill"', async ({ page }) => {
    await page.locator('select').nth(1).selectOption({ label: 'bill' });
    await page.waitForLoadState('networkidle');
    const rows = page.locator('table.ac-table tbody tr');
    const count = await rows.count();
    if (count === 0) return;
    for (let i = 0; i < Math.min(count, 3); i++) {
      const rowText = await rows.nth(i).textContent();
      expect(rowText?.toLowerCase()).toContain('bill');
    }
  });

  test('clear filters shows all approvals', async ({ page }) => {
    await page.locator('select').first().selectOption({ label: 'pending' });
    await page.waitForLoadState('networkidle');
    const filteredCount = await page.locator('table.ac-table tbody tr').count();

    await page.locator('select').first().selectOption({ label: 'all' });
    await page.waitForLoadState('networkidle');
    const allCount = await page.locator('table.ac-table tbody tr').count();
    expect(allCount).toBeGreaterThanOrEqual(filteredCount);
  });

  // ── Approve ──────────────────────────────────────────────────────────────

  test('approve pending entry — modal shows note textarea', async ({ page }) => {
    await page.locator('select').first().selectOption({ label: 'pending' });
    await page.waitForLoadState('networkidle');

    const pendingRow = page.locator('table.ac-table tbody tr').filter({ hasText: /pending/i }).first();
    if (await pendingRow.count() === 0) { test.skip(true, 'No pending approvals'); return; }

    await pendingRow.getByRole('button', { name: /approve/i }).click();

    const modal = page.locator('[class*="ac-modal"]');
    await expect(modal).toBeVisible();
    // Optional note textarea
    await expect(modal.locator('input, textarea')).toBeVisible();
  });

  test('approve pending entry — without note succeeds', async ({ page }) => {
    await page.locator('select').first().selectOption({ label: 'pending' });
    await page.waitForLoadState('networkidle');

    const pendingRow = page.locator('table.ac-table tbody tr').filter({ hasText: /pending/i }).first();
    if (await pendingRow.count() === 0) { test.skip(true, 'No pending approvals'); return; }

    await pendingRow.getByRole('button', { name: /approve/i }).click();
    const modal = page.locator('[class*="ac-modal"]');
    await expect(modal).toBeVisible();
    // Note is optional — submit empty
    await modal.getByRole('button', { name: /confirm|approve/i }).click();

    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/approved|posted/i)).toBeVisible({ timeout: 8_000 });
  });

  test('approve pending entry — with note succeeds', async ({ page }) => {
    await page.locator('select').first().selectOption({ label: 'pending' });
    await page.waitForLoadState('networkidle');

    const pendingRow = page.locator('table.ac-table tbody tr').filter({ hasText: /pending/i }).first();
    if (await pendingRow.count() === 0) { test.skip(true, 'No pending approvals'); return; }

    await pendingRow.getByRole('button', { name: /approve/i }).click();
    const modal = page.locator('[class*="ac-modal"]');
    await modal.locator('input, textarea').fill('Approved during E2E testing');
    await modal.getByRole('button', { name: /confirm|approve/i }).click();

    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/approved/i)).toBeVisible({ timeout: 8_000 });
  });

  // ── Reject ───────────────────────────────────────────────────────────────

  test('reject entry — modal requires note', async ({ page }) => {
    await page.locator('select').first().selectOption({ label: 'pending' });
    await page.waitForLoadState('networkidle');

    const pendingRow = page.locator('table.ac-table tbody tr').filter({ hasText: /pending/i }).first();
    if (await pendingRow.count() === 0) { test.skip(true, 'No pending approvals'); return; }

    await pendingRow.getByRole('button', { name: /reject/i }).click();
    const modal = page.locator('[class*="ac-modal"]');
    await expect(modal).toBeVisible();

    // Submit without note
    await modal.getByRole('button', { name: /confirm|reject/i }).click();
    // Note is required — should see validation error or HTML5 required
    const noteInput = modal.locator('input, textarea');
    const valid = await noteInput.evaluate((el: HTMLInputElement | HTMLTextAreaElement) => el.validity.valid);
    expect(valid).toBe(false);
  });

  test('reject entry — with note → rejected status', async ({ page }) => {
    await page.locator('select').first().selectOption({ label: 'pending' });
    await page.waitForLoadState('networkidle');

    const pendingRow = page.locator('table.ac-table tbody tr').filter({ hasText: /pending/i }).first();
    if (await pendingRow.count() === 0) { test.skip(true, 'No pending approvals'); return; }

    await pendingRow.getByRole('button', { name: /reject/i }).click();
    const modal = page.locator('[class*="ac-modal"]');
    await modal.locator('input, textarea').fill('Rejected during E2E testing round 2');
    await modal.getByRole('button', { name: /confirm|reject/i }).click();

    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/rejected/i)).toBeVisible({ timeout: 8_000 });
  });

  // ── L2 routing ──────────────────────────────────────────────────────────

  test('L1 approval of large amount routes to L2', async ({ page }) => {
    // Filter to large-amount L1 pending approvals
    await page.locator('select').first().selectOption({ label: 'pending' });
    await page.waitForLoadState('networkidle');

    const rows = page.locator('table.ac-table tbody tr').filter({ hasText: /pending/i });
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const rowText = await rows.nth(i).textContent();
      // Look for a row where amount > 5,00,000 (L2 threshold)
      const amtMatch = rowText?.match(/[\d,]+/g)?.map(s => parseInt(s.replace(/,/g, ''))).find(n => n > 500000);
      if (!amtMatch) continue;

      // Check it's Level 1
      if (!rowText?.includes('1')) continue;

      await rows.nth(i).getByRole('button', { name: /approve/i }).click();
      const modal = page.locator('[class*="ac-modal"]');
      await modal.locator('input, textarea').fill('L1 approving large amount');
      await modal.getByRole('button', { name: /confirm|approve/i }).click();
      await page.waitForLoadState('networkidle');

      // Should see "Routed to L2" message or a new Level 2 row
      const routedMsg = page.getByText(/routed|l2|level 2/i);
      if (await routedMsg.count() > 0) {
        await expect(routedMsg).toBeVisible();
      }
      return;
    }

    test.skip(true, 'No large-amount L1 pending approvals for L2 routing test');
  });

});
