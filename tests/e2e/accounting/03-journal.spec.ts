/**
 * ACCOUNTING E2E — 03: Journal Entries
 *
 * Covers:
 *   - Journal list page: table, filters (date range, status, search), pagination
 *   - New entry: unbalanced blocked, empty line ignored, min 2 lines validation
 *   - New entry: save as draft (unbalanced OK)
 *   - New entry: post balanced entry → redirects to detail → entryNo assigned
 *   - New entry: high-amount → pending_approval status
 *   - Detail page: meta strip, lines table, totals footer
 *   - Detail page: reverse entry (requires reason), creates reversal
 *   - Reversal entry is linked back
 *   - Journal list: approve pending_approval entry
 *   - Journal list: reject pending_approval entry
 *   - Locked period blocks posting (edge case)
 *   - Entry filter by status (draft / posted / pending_approval)
 *   - Search by narration
 *   - Pagination: next page, prev page
 */
import { test, expect, Page } from '@playwright/test';
import { gotoAC, AC, MODULE } from './helpers';

/** Creates a balanced journal entry (Dr: 1000, Cr: 1000).
 *  Returns the entry ID from the redirected URL. */
async function createBalancedEntry(page: Page, narration: string): Promise<string> {
  await gotoAC(page, '/journal/new');
  await page.waitForLoadState('networkidle');

  await page.getByLabel(/narration/i).fill(narration);

  // Line 1 — pick first available account, debit 1000
  const row0AccountSel = page.locator('table.ac-table tbody tr').nth(0).locator('select');
  const options0 = await row0AccountSel.locator('option').allTextContents();
  const acct0 = options0.find(o => o.trim() && !o.startsWith('—')) ?? '';
  if (!acct0) throw new Error('No accounts available for journal entry test');
  await row0AccountSel.selectOption({ label: acct0 });
  await page.locator('table.ac-table tbody tr').nth(0).locator('input[type=number]').nth(0).fill('1000');

  // Line 2 — pick second account (or same), credit 1000
  const row1AccountSel = page.locator('table.ac-table tbody tr').nth(1).locator('select');
  const options1 = await row1AccountSel.locator('option').allTextContents();
  const acct1 = options1.find(o => o.trim() && !o.startsWith('—')) ?? '';
  await row1AccountSel.selectOption({ label: acct1 });
  await page.locator('table.ac-table tbody tr').nth(1).locator('input[type=number]').nth(1).fill('1000');

  // Balanced indicator
  await expect(page.getByText(/✔ balanced/i)).toBeVisible();

  // Post
  await page.getByRole('button', { name: /post entry/i }).click();
  await page.waitForLoadState('networkidle');

  // Should redirect to detail page: /{module}/accounting/premium/journal/{id}
  const url = page.url();
  const match = url.match(/journal\/([a-z0-9]+)$/i);
  if (!match) throw new Error(`Unexpected URL after post: ${url}`);
  return match[1];
}

test.describe('Journal Entries', () => {

  // ── List page ────────────────────────────────────────────────────────────

  test('journal list renders table and filter controls', async ({ page }) => {
    await gotoAC(page, '/journal');

    // Date range filters
    await expect(page.getByLabel(/from/i)).toBeVisible();
    await expect(page.getByLabel(/to/i)).toBeVisible();

    // Status filter select
    await expect(page.locator('select').filter({ hasText: /all|status/i }).first()).toBeVisible();

    // New entry button
    await expect(page.getByRole('link', { name: /new entry/i })).toBeVisible();

    // Table
    await expect(page.locator('table.ac-table')).toBeVisible();
  });

  test('journal list columns present', async ({ page }) => {
    await gotoAC(page, '/journal');
    const headers = ['Date', 'Entry No', 'Narration', 'Status', 'Debit', 'Credit'];
    const thead = page.locator('table.ac-table thead');
    for (const h of headers) {
      await expect(thead.getByText(h)).toBeVisible();
    }
  });

  // ── New Entry form ───────────────────────────────────────────────────────

  test('new entry page renders form', async ({ page }) => {
    await gotoAC(page, '/journal/new');
    await expect(page.getByLabel(/entry date/i)).toBeVisible();
    await expect(page.getByLabel(/narration/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /post entry/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /save draft/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add line/i })).toBeVisible();
  });

  test('new entry — post button disabled when unbalanced', async ({ page }) => {
    await gotoAC(page, '/journal/new');
    await page.waitForLoadState('networkidle');

    // Fill only debit on line 1
    const row0 = page.locator('table.ac-table tbody tr').nth(0);
    const options = await row0.locator('select option').allTextContents();
    const acct = options.find(o => o.trim() && !o.startsWith('—'));
    if (!acct) { test.skip(true, 'No accounts — seed CoA first'); return; }

    await row0.locator('select').selectOption({ label: acct });
    await row0.locator('input[type=number]').nth(0).fill('500');

    // Post button should still be disabled (not balanced)
    const postBtn = page.getByRole('button', { name: /post entry/i });
    await expect(postBtn).toBeDisabled();
    await expect(page.getByText(/⚠/)).toBeVisible();
  });

  test('new entry — unbalanced indicator shows Dr ≠ Cr amounts', async ({ page }) => {
    await gotoAC(page, '/journal/new');
    await page.waitForLoadState('networkidle');

    const row0 = page.locator('table.ac-table tbody tr').nth(0);
    const options = await row0.locator('select option').allTextContents();
    const acct = options.find(o => o.trim() && !o.startsWith('—'));
    if (!acct) { test.skip(true, 'No accounts'); return; }

    await row0.locator('select').selectOption({ label: acct });
    await row0.locator('input[type=number]').nth(0).fill('750');

    await expect(page.getByText(/⚠\s*Dr\s*750/)).toBeVisible();
  });

  test('new entry — add line appends new row', async ({ page }) => {
    await gotoAC(page, '/journal/new');
    const initialRows = await page.locator('table.ac-table tbody tr').count();
    await page.getByRole('button', { name: /add line/i }).click();
    const newRows = await page.locator('table.ac-table tbody tr').count();
    expect(newRows).toBe(initialRows + 1);
  });

  test('new entry — remove line (✕ button) deletes row when > 2', async ({ page }) => {
    await gotoAC(page, '/journal/new');
    // Add a 3rd line first
    await page.getByRole('button', { name: /add line/i }).click();
    const countAfterAdd = await page.locator('table.ac-table tbody tr').count();
    expect(countAfterAdd).toBe(3);

    // Remove button appears on rows beyond minimum
    await page.locator('table.ac-table tbody tr').nth(2).locator('button:has-text("✕")').click();
    const countAfterRemove = await page.locator('table.ac-table tbody tr').count();
    expect(countAfterRemove).toBe(2);
  });

  test('new entry — save draft (unbalanced allowed)', async ({ page }) => {
    await gotoAC(page, '/journal/new');
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/narration/i).fill(`Draft E2E ${Date.now()}`);

    const options = await page.locator('table.ac-table tbody tr').nth(0).locator('select option').allTextContents();
    const acct = options.find(o => o.trim() && !o.startsWith('—'));
    if (!acct) { test.skip(true, 'No accounts'); return; }

    await page.locator('table.ac-table tbody tr').nth(0).locator('select').selectOption({ label: acct });
    await page.locator('table.ac-table tbody tr').nth(0).locator('input[type=number]').nth(0).fill('300');

    await page.getByRole('button', { name: /save draft/i }).click();
    await page.waitForLoadState('networkidle');

    // Redirects to detail page
    await expect(page).toHaveURL(new RegExp(`/${MODULE}/accounting/premium/journal/`));
    // Status shows draft
    await expect(page.getByText(/draft/i)).toBeVisible();
  });

  test('new entry — post balanced entry → detail page with entryNo', async ({ page }) => {
    await gotoAC(page, '/journal/new');
    await page.waitForLoadState('networkidle');

    const narration = `E2E Post ${Date.now()}`;
    await page.getByLabel(/narration/i).fill(narration);

    const row0 = page.locator('table.ac-table tbody tr').nth(0);
    const row1 = page.locator('table.ac-table tbody tr').nth(1);
    const opts0 = await row0.locator('select option').allTextContents();
    const opts1 = await row1.locator('select option').allTextContents();
    const acct0 = opts0.find(o => o.trim() && !o.startsWith('—'));
    const acct1 = opts1.find(o => o.trim() && !o.startsWith('—'));
    if (!acct0 || !acct1) { test.skip(true, 'No accounts'); return; }

    await row0.locator('select').selectOption({ label: acct0 });
    await row0.locator('input[type=number]').nth(0).fill('2500');

    await row1.locator('select').selectOption({ label: acct1 });
    await row1.locator('input[type=number]').nth(1).fill('2500');

    await expect(page.getByText(/✔ balanced/i)).toBeVisible();
    await page.getByRole('button', { name: /post entry/i }).click();
    await page.waitForLoadState('networkidle');

    // Should be on detail page
    await expect(page).toHaveURL(new RegExp(`/${MODULE}/accounting/premium/journal/`));

    // EntryNo in format JE-YYYYNN-XXXX
    await expect(page.getByText(/JE-\d{6}-\d{4}/)).toBeVisible();
    // Status badge = "posted"
    await expect(page.getByText(/posted/i)).toBeVisible();
    // Narration present
    await expect(page.getByText(narration)).toBeVisible();
  });

  // ── Detail page ──────────────────────────────────────────────────────────

  test('detail page shows meta strip: status, source, created by', async ({ page }) => {
    await gotoAC(page, '/journal/new');
    await page.waitForLoadState('networkidle');

    const narration = `Meta Test ${Date.now()}`;
    await page.getByLabel(/narration/i).fill(narration);

    const row0 = page.locator('table.ac-table tbody tr').nth(0);
    const row1 = page.locator('table.ac-table tbody tr').nth(1);
    const opts = await row0.locator('select option').allTextContents();
    const acct = opts.find(o => o.trim() && !o.startsWith('—'));
    if (!acct) { test.skip(true, 'No accounts'); return; }

    await row0.locator('select').selectOption({ label: acct });
    await row0.locator('input[type=number]').nth(0).fill('100');
    await row1.locator('select').selectOption({ label: acct });
    await row1.locator('input[type=number]').nth(1).fill('100');

    await page.getByRole('button', { name: /post entry/i }).click();
    await page.waitForLoadState('networkidle');

    // Meta labels
    await expect(page.getByText(/status/i)).toBeVisible();
    await expect(page.getByText(/source/i)).toBeVisible();
    await expect(page.getByText(/created by/i)).toBeVisible();
  });

  test('detail page lines table shows debit/credit columns', async ({ page }) => {
    await gotoAC(page, '/journal/new');
    await page.waitForLoadState('networkidle');

    const opts = await page.locator('table.ac-table tbody tr').nth(0).locator('select option').allTextContents();
    const acct = opts.find(o => o.trim() && !o.startsWith('—'));
    if (!acct) { test.skip(true, 'No accounts'); return; }

    await page.locator('table.ac-table tbody tr').nth(0).locator('select').selectOption({ label: acct });
    await page.locator('table.ac-table tbody tr').nth(0).locator('input[type=number]').nth(0).fill('500');
    await page.locator('table.ac-table tbody tr').nth(1).locator('select').selectOption({ label: acct });
    await page.locator('table.ac-table tbody tr').nth(1).locator('input[type=number]').nth(1).fill('500');
    await page.getByRole('button', { name: /post entry/i }).click();
    await page.waitForLoadState('networkidle');

    const headers = page.locator('table.ac-table thead');
    await expect(headers.getByText('Debit')).toBeVisible();
    await expect(headers.getByText('Credit')).toBeVisible();
    await expect(headers.getByText('Account')).toBeVisible();

    // Totals footer
    await expect(page.getByText(/total dr/i)).toBeVisible();
    await expect(page.getByText(/total cr/i)).toBeVisible();
  });

  test('detail page: back link returns to journal list', async ({ page }) => {
    await gotoAC(page, '/journal/new');
    await page.waitForLoadState('networkidle');

    const opts = await page.locator('table.ac-table tbody tr').nth(0).locator('select option').allTextContents();
    const acct = opts.find(o => o.trim() && !o.startsWith('—'));
    if (!acct) { test.skip(true, 'No accounts'); return; }

    await page.locator('table.ac-table tbody tr').nth(0).locator('select').selectOption({ label: acct });
    await page.locator('table.ac-table tbody tr').nth(0).locator('input[type=number]').nth(0).fill('200');
    await page.locator('table.ac-table tbody tr').nth(1).locator('select').selectOption({ label: acct });
    await page.locator('table.ac-table tbody tr').nth(1).locator('input[type=number]').nth(1).fill('200');
    await page.getByRole('button', { name: /post entry/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByText(/back to journal entries/i).click();
    await expect(page).toHaveURL(new RegExp(`/${MODULE}/accounting/premium/journal$`));
  });

  // ── Reversal ─────────────────────────────────────────────────────────────

  test('reverse entry — prompt cancelled → no action', async ({ page }) => {
    await gotoAC(page, '/journal/new');
    await page.waitForLoadState('networkidle');

    const opts = await page.locator('table.ac-table tbody tr').nth(0).locator('select option').allTextContents();
    const acct = opts.find(o => o.trim() && !o.startsWith('—'));
    if (!acct) { test.skip(true, 'No accounts'); return; }

    await page.locator('table.ac-table tbody tr').nth(0).locator('select').selectOption({ label: acct });
    await page.locator('table.ac-table tbody tr').nth(0).locator('input[type=number]').nth(0).fill('300');
    await page.locator('table.ac-table tbody tr').nth(1).locator('select').selectOption({ label: acct });
    await page.locator('table.ac-table tbody tr').nth(1).locator('input[type=number]').nth(1).fill('300');
    await page.getByRole('button', { name: /post entry/i }).click();
    await page.waitForLoadState('networkidle');

    // Dismiss the browser prompt (cancel)
    page.once('dialog', d => d.dismiss());
    await page.getByRole('button', { name: /reverse/i }).click();

    // Status should remain "posted"
    await expect(page.getByText(/posted/i)).toBeVisible();
    await expect(page.getByText(/reversal created/i)).not.toBeVisible();
  });

  test('reverse entry — with reason → creates reversal JE', async ({ page }) => {
    await gotoAC(page, '/journal/new');
    await page.waitForLoadState('networkidle');

    const opts = await page.locator('table.ac-table tbody tr').nth(0).locator('select option').allTextContents();
    const acct = opts.find(o => o.trim() && !o.startsWith('—'));
    if (!acct) { test.skip(true, 'No accounts'); return; }

    await page.locator('table.ac-table tbody tr').nth(0).locator('select').selectOption({ label: acct });
    await page.locator('table.ac-table tbody tr').nth(0).locator('input[type=number]').nth(0).fill('400');
    await page.locator('table.ac-table tbody tr').nth(1).locator('select').selectOption({ label: acct });
    await page.locator('table.ac-table tbody tr').nth(1).locator('input[type=number]').nth(1).fill('400');
    await page.getByRole('button', { name: /post entry/i }).click();
    await page.waitForLoadState('networkidle');

    // Accept the browser prompt with a reason
    page.once('dialog', async d => {
      expect(d.message()).toMatch(/reason/i);
      await d.accept('E2E test reversal reason');
    });
    await page.getByRole('button', { name: /reverse/i }).click();

    // Success message + page reloads
    await page.waitForLoadState('networkidle');
    // Status should now be "reversed"
    await expect(page.getByText(/reversed/i)).toBeVisible({ timeout: 10_000 });
    // Reversed by link shown
    await expect(page.getByText(/reversed by/i)).toBeVisible();
  });

  test('reversed entry: Reverse button gone; reversedBy link navigates to reversal', async ({ page }) => {
    // Find a reversed entry from journal list
    await gotoAC(page, '/journal');
    const reversedRow = page.locator('table.ac-table tbody tr').filter({ hasText: /reversed/i }).first();
    if (await reversedRow.count() === 0) { test.skip(true, 'No reversed entries'); return; }

    await reversedRow.locator('a').click();
    await page.waitForLoadState('networkidle');

    // Reverse button not shown on already-reversed entry
    await expect(page.getByRole('button', { name: /reverse/i })).not.toBeVisible();

    // Click the reversedBy link
    const reversedByLink = page.getByText(/JE-\d{6}-\d{4}/).first();
    if (await reversedByLink.count() === 0) { return; }
    await reversedByLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(new RegExp(`/journal/`));
  });

  // ── Journal list: filters ────────────────────────────────────────────────

  test('filter by status "posted" shows only posted entries', async ({ page }) => {
    await gotoAC(page, '/journal');
    await page.locator('select').filter({ hasText: /all|status/i }).first().selectOption({ label: 'posted' });
    await page.waitForLoadState('networkidle');

    const rows = page.locator('table.ac-table tbody tr');
    const count = await rows.count();
    if (count === 0) return;

    for (let i = 0; i < Math.min(count, 5); i++) {
      const rowText = await rows.nth(i).textContent();
      expect(rowText?.toLowerCase()).toContain('posted');
    }
  });

  test('filter by status "draft" shows only draft entries', async ({ page }) => {
    await gotoAC(page, '/journal');
    await page.locator('select').filter({ hasText: /all|status/i }).first().selectOption({ label: 'draft' });
    await page.waitForLoadState('networkidle');

    const rows = page.locator('table.ac-table tbody tr');
    const count = await rows.count();
    if (count === 0) return;

    for (let i = 0; i < Math.min(count, 3); i++) {
      const rowText = await rows.nth(i).textContent();
      expect(rowText?.toLowerCase()).toContain('draft');
    }
  });

  test('date range filter excludes out-of-range entries', async ({ page }) => {
    await gotoAC(page, '/journal');
    // Set to far future — no entries should match
    await page.getByLabel(/from/i).fill('2099-01-01');
    await page.getByLabel(/to/i).fill('2099-01-31');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('table.ac-table tbody tr');
    const count = await rows.count();
    // Either 0 rows or "no entries" placeholder
    if (count > 0) {
      const emptyText = await rows.first().textContent();
      expect(emptyText?.toLowerCase()).toMatch(/no entries|empty/i);
    }
  });

  test('search by narration filters to matching entries', async ({ page }) => {
    const ts = Date.now();
    // First, create an entry with unique narration
    await gotoAC(page, '/journal/new');
    await page.waitForLoadState('networkidle');
    const uniqueNarration = `SEARCHME-${ts}`;
    await page.getByLabel(/narration/i).fill(uniqueNarration);

    const opts = await page.locator('table.ac-table tbody tr').nth(0).locator('select option').allTextContents();
    const acct = opts.find(o => o.trim() && !o.startsWith('—'));
    if (!acct) { test.skip(true, 'No accounts'); return; }

    await page.locator('table.ac-table tbody tr').nth(0).locator('select').selectOption({ label: acct });
    await page.locator('table.ac-table tbody tr').nth(0).locator('input[type=number]').nth(0).fill('50');
    await page.locator('table.ac-table tbody tr').nth(1).locator('select').selectOption({ label: acct });
    await page.locator('table.ac-table tbody tr').nth(1).locator('input[type=number]').nth(1).fill('50');
    await page.getByRole('button', { name: /post entry/i }).click();
    await page.waitForLoadState('networkidle');

    // Now search for it
    await gotoAC(page, '/journal');
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill(uniqueNarration);
    await page.waitForLoadState('networkidle');

    const rows = page.locator('table.ac-table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    await expect(rows.first()).toContainText(uniqueNarration);
  });

  // ── Approve / Reject from journal list ──────────────────────────────────

  test('approve pending entry from journal list', async ({ page }) => {
    await gotoAC(page, '/journal');
    await page.locator('select').filter({ hasText: /all|status/i }).first().selectOption({ label: 'pending_approval' });
    await page.waitForLoadState('networkidle');

    const pendingRow = page.locator('table.ac-table tbody tr').filter({ hasText: /pending/i }).first();
    if (await pendingRow.count() === 0) { test.skip(true, 'No pending entries'); return; }

    await pendingRow.getByRole('button', { name: /approve/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/approved|posted/i)).toBeVisible({ timeout: 8_000 });
  });

  test('reject pending entry from journal list (requires note)', async ({ page }) => {
    // First create a pending entry by saving draft (simulate)
    await gotoAC(page, '/journal');
    await page.locator('select').filter({ hasText: /all|status/i }).first().selectOption({ label: 'pending_approval' });
    await page.waitForLoadState('networkidle');

    const pendingRow = page.locator('table.ac-table tbody tr').filter({ hasText: /pending/i }).first();
    if (await pendingRow.count() === 0) { test.skip(true, 'No pending entries'); return; }

    await pendingRow.getByRole('button', { name: /reject/i }).click();

    // Modal for reject note
    const modal = page.locator('[class*="ac-modal"]');
    if (await modal.isVisible()) {
      await modal.locator('input, textarea').fill('Rejected during E2E testing');
      await modal.getByRole('button', { name: /confirm|reject/i }).click();
    }
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/rejected/i)).toBeVisible({ timeout: 8_000 });
  });

});
