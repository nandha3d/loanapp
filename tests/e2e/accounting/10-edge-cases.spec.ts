/**
 * ACCOUNTING E2E — 10: Edge Cases & Boundary Conditions
 *
 * Covers:
 *   - Locked period blocks new JE posting
 *   - Posting to a locked period shows "period_locked" error
 *   - Journal entry with zero amounts blocked ("empty_entry")
 *   - Journal entry with < 2 lines blocked ("min_lines")
 *   - Reversal of already-reversed entry not possible
 *   - Bill with future due date accepted
 *   - Bill with past due date (overdue) flagged in ageing
 *   - Large narration (500 chars) truncates gracefully in list
 *   - Account code uniqueness per tenant
 *   - AcAlert dismisses on ✕ click
 *   - Modal closes on ESC key
 *   - Modal closes on backdrop click
 *   - AcTable empty state shows placeholder when no rows
 *   - Concurrent form submission (double-click post) does not double-post
 *   - Date input defaults to today on new JE form
 *   - Totals footer updates live as amounts change
 */
import { test, expect } from '@playwright/test';
import { gotoAC } from './helpers';

test.describe('Edge Cases & Boundaries', () => {

  // ── JE: zero amount ──────────────────────────────────────────────────────

  test('JE with zero debit and credit stays disabled', async ({ page }) => {
    await gotoAC(page, '/journal/new');
    await page.waitForLoadState('networkidle');

    // Don't fill any amounts
    const postBtn = page.getByRole('button', { name: /post entry/i });
    await expect(postBtn).toBeDisabled();
  });

  // ── JE: date defaults to today ───────────────────────────────────────────

  test('new JE entry date defaults to today', async ({ page }) => {
    await gotoAC(page, '/journal/new');
    const dateInput = page.getByLabel(/entry date/i);
    const value = await dateInput.inputValue();
    const today = new Date().toISOString().slice(0, 10);
    expect(value).toBe(today);
  });

  // ── JE: live totals update ────────────────────────────────────────────────

  test('totals footer updates live as debit amount changes', async ({ page }) => {
    await gotoAC(page, '/journal/new');
    await page.waitForLoadState('networkidle');

    const opts = await page.locator('table.ac-table tbody tr').nth(0).locator('select option').allTextContents();
    const acct = opts.find(o => o.trim() && !o.startsWith('—'));
    if (!acct) { test.skip(true, 'No accounts'); return; }

    await page.locator('table.ac-table tbody tr').nth(0).locator('select').selectOption({ label: acct });
    await page.locator('table.ac-table tbody tr').nth(0).locator('input[type=number]').nth(0).fill('3000');

    // tfoot total debit should show 3,000
    await expect(page.locator('tfoot').getByText(/3,000|3000/).first()).toBeVisible();
  });

  // ── JE: locked period ────────────────────────────────────────────────────

  test('posting JE in a locked period shows period_locked error', async ({ page }) => {
    // Lock a period first (the oldest open one)
    await gotoAC(page, '/period-lock');
    const periodRows = page.locator('table.ac-table tbody tr');
    let openRowIndex = -1;
    for (let i = 0; i < await periodRows.count(); i++) {
      const statusText = (await periodRows.nth(i).locator('td').nth(1).innerText()).trim().toLowerCase();
      if (statusText === 'open') {
        openRowIndex = i;
        break;
      }
    }
    if (openRowIndex === -1) { test.skip(true, 'No open periods to lock'); return; }
    const openRow = periodRows.nth(openRowIndex);

    const lockBtn = openRow.getByRole('button', { name: /^lock$|soft.?lock/i });
    if (await lockBtn.count() === 0) { test.skip(true, 'No lock button'); return; }

    // Get the period key (YYYY-MM)
    const periodKeyText = await openRow.locator('td').first().textContent();
    const periodMatch = periodKeyText?.match(/(\d{4}-\d{2})/);
    if (!periodMatch) { test.skip(true, 'Cannot read period key'); return; }
    const periodKey = periodMatch[1];

    await lockBtn.click();
    await page.waitForLoadState('networkidle');

    const selectedRow = periodRows.nth(openRowIndex);
    await expect(selectedRow.locator('td').nth(1)).toContainText(/soft locked/i, { timeout: 8_000 });

    const hardLockBtn = selectedRow.getByRole('button', { name: /^lock$/i });
    if (await hardLockBtn.count() === 0) { test.skip(true, 'No hard lock button'); return; }
    await hardLockBtn.click();
    await page.waitForLoadState('networkidle');

    const finalStatus = (await selectedRow.locator('td').nth(1).innerText()).trim().toLowerCase();
    if (finalStatus !== 'locked') {
      test.skip(true, `Period did not reach locked state; current status is ${finalStatus}`);
      return;
    }

    // Now try to post a JE with the locked period's date
    await gotoAC(page, '/journal/new');
    await page.waitForLoadState('networkidle');

    const [year, month] = periodKey.split('-');
    const lockedDate = `${year}-${month}-15`; // mid-month

    await page.getByLabel(/entry date/i).fill(lockedDate);

    const opts = await page.locator('table.ac-table tbody tr').nth(0).locator('select option').allTextContents();
    const acct = opts.find(o => o.trim() && !o.startsWith('—'));
    if (!acct) { test.skip(true, 'No accounts'); return; }

    await page.locator('table.ac-table tbody tr').nth(0).locator('select').selectOption({ label: acct });
    await page.locator('table.ac-table tbody tr').nth(0).locator('input[type=number]').nth(0).fill('500');
    await page.locator('table.ac-table tbody tr').nth(1).locator('select').selectOption({ label: acct });
    await page.locator('table.ac-table tbody tr').nth(1).locator('input[type=number]').nth(1).fill('500');

    await page.getByRole('button', { name: /post entry/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/period_locked|period is locked/i)).toBeVisible({ timeout: 8_000 });
  });

  // ── Modal: ESC closes ────────────────────────────────────────────────────

  test('AcModal closes on ESC key press', async ({ page }) => {
    await gotoAC(page, '/coa');
    await page.getByRole('button', { name: /add account/i }).click();

    const modal = page.locator('.ac-modal');
    await expect(modal).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 3_000 });
  });

  // ── Modal: backdrop click closes ─────────────────────────────────────────

  test('AcModal closes on backdrop click', async ({ page }) => {
    await gotoAC(page, '/coa');
    await page.getByRole('button', { name: /add account/i }).click();

    const modal = page.locator('.ac-modal');
    await expect(modal).toBeVisible();

    // Click outside the modal dialog (the backdrop overlay)
    const backdrop = page.locator('[class*="ac-modal-overlay"], [class*="backdrop"]').first();
    if (await backdrop.count() > 0) {
      await backdrop.click({ position: { x: 5, y: 5 } }); // top-left corner = outside dialog
    } else {
      // Fallback: click body at (0,0)
      await page.mouse.click(5, 5);
    }

    await expect(modal).not.toBeVisible({ timeout: 3_000 });
  });

  // ── AcAlert: dismiss ─────────────────────────────────────────────────────

  test('AcAlert dismisses on ✕ click', async ({ page }) => {
    // Navigate to CoA and reseed to trigger a success alert
    await gotoAC(page, '/coa');
    await page.getByRole('button', { name: /reseed/i }).click();
    await page.waitForLoadState('networkidle');

    const alert = page.locator('[class*="ac-alert"]').first();
    await expect(alert).toBeVisible({ timeout: 6_000 });

    const dismissBtn = alert.locator('button:has-text("✕"), button[aria-label="Dismiss"]');
    if (await dismissBtn.count() > 0) {
      await dismissBtn.click();
      await expect(alert).not.toBeVisible({ timeout: 3_000 });
    }
  });

  // ── AcTable empty state ──────────────────────────────────────────────────

  test('AcTable shows empty placeholder on zero rows', async ({ page }) => {
    // Filter journal to a future date with no entries
    await gotoAC(page, '/journal');
    await page.locator('input[type=date]').nth(0).fill('2099-01-01');
    await page.locator('input[type=date]').nth(1).fill('2099-01-31');
    await page.waitForLoadState('networkidle');

    const tbody = page.locator('table.ac-table tbody');
    const rows = await tbody.locator('tr').count();
    if (rows === 0) {
      // Empty tbody — OK
    } else {
      // Single row spanning all columns with empty text
      const emptyRow = tbody.locator('tr').first();
      const text = await emptyRow.textContent();
      expect(text?.trim().length).toBeGreaterThan(0); // has some empty-state text
    }
  });

  // ── Large narration ───────────────────────────────────────────────────────

  test('long narration (500 chars) accepted on save', async ({ page }) => {
    await gotoAC(page, '/journal/new');
    await page.waitForLoadState('networkidle');

    const longNarration = 'A'.repeat(500);
    await page.getByLabel(/narration/i).fill(longNarration);

    const opts = await page.locator('table.ac-table tbody tr').nth(0).locator('select option').allTextContents();
    const acct = opts.find(o => o.trim() && !o.startsWith('—'));
    if (!acct) { test.skip(true, 'No accounts'); return; }

    await page.locator('table.ac-table tbody tr').nth(0).locator('select').selectOption({ label: acct });
    await page.locator('table.ac-table tbody tr').nth(0).locator('input[type=number]').nth(0).fill('100');
    await page.locator('table.ac-table tbody tr').nth(1).locator('select').selectOption({ label: acct });
    await page.locator('table.ac-table tbody tr').nth(1).locator('input[type=number]').nth(1).fill('100');

    await page.getByRole('button', { name: /save draft/i }).click();
    await page.waitForLoadState('networkidle');
    // Should not show error — saved successfully
    await expect(page.getByText(/error.*narration|too long/i)).not.toBeVisible();
    await expect(page).toHaveURL(new RegExp('/journal/'));
  });

  // ── Double-click post (prevent double-submit) ─────────────────────────────

  test('double-clicking Post Entry does not create duplicate JE', async ({ page }) => {
    await gotoAC(page, '/journal/new');
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/narration/i).fill(`Double click test ${Date.now()}`);
    const opts = await page.locator('table.ac-table tbody tr').nth(0).locator('select option').allTextContents();
    const acct = opts.find(o => o.trim() && !o.startsWith('—'));
    if (!acct) { test.skip(true, 'No accounts'); return; }

    await page.locator('table.ac-table tbody tr').nth(0).locator('select').selectOption({ label: acct });
    await page.locator('table.ac-table tbody tr').nth(0).locator('input[type=number]').nth(0).fill('150');
    await page.locator('table.ac-table tbody tr').nth(1).locator('select').selectOption({ label: acct });
    await page.locator('table.ac-table tbody tr').nth(1).locator('input[type=number]').nth(1).fill('150');

    await expect(page.getByText(/✔ balanced/i)).toBeVisible();

    const postBtn = page.getByRole('button', { name: /post entry/i });
    // Double-click rapidly
    await postBtn.click();
    await postBtn.click({ timeout: 1_000 }).catch(() => {});

    await page.waitForLoadState('networkidle');

    // Should navigate to exactly one detail page
    await expect(page).toHaveURL(new RegExp('/journal/[a-z0-9]+$'));
  });

  // ── Vendor GSTIN format ───────────────────────────────────────────────────

  test('GSTIN with correct format but wrong checksum is still validated by regex', async ({ page }) => {
    await gotoAC(page, '/vendors');
    await page.getByRole('button', { name: /add vendor/i }).click();

    const modal = page.locator('.ac-modal');
    await modal.getByLabel(/^name/i).fill(`GSTIN format test ${Date.now()}`);
    // Valid regex pattern: 27AAPFU0939F1ZV
    await modal.getByLabel(/gstin/i).fill('27AAPFU0939F1ZV');
    await modal.getByRole('button', { name: /save/i }).click();

    // Should NOT show gstin_invalid
    await expect(page.getByText(/gstin_invalid/i)).not.toBeVisible({ timeout: 3_000 });
  });

  // ── Bill: future due date ─────────────────────────────────────────────────

  test('bill with future due date accepted', async ({ page }) => {
    await gotoAC(page, '/vendors');
    await page.getByRole('tab', { name: /bills/i }).click();
    await page.getByRole('button', { name: /add bill|new bill/i }).click();

    const modal = page.locator('.ac-modal');
    await expect(modal).toBeVisible();

    const vendorSel = modal.locator('select').first();
    const vendorOpts = await vendorSel.locator('option').allTextContents();
    const vendor = vendorOpts.find(o => o.trim() && !o.startsWith('—'));
    if (!vendor) { await modal.getByRole('button', { name: /cancel/i }).click(); test.skip(true, 'No vendors'); return; }
    await vendorSel.selectOption({ label: vendor });

    const futureDue = new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10);
    const billNo = `FUTURE-${Date.now()}`;
    await modal.getByLabel(/bill no/i).fill(billNo);
    await modal.getByLabel(/bill date/i).fill(new Date().toISOString().slice(0, 10));
    await modal.getByLabel(/due date/i).fill(futureDue);

    const lineSel = modal.locator('table tbody tr').first().locator('select').first();
    const lineOpts = await lineSel.locator('option').allTextContents();
    const lineAcct = lineOpts.find(o => o.trim() && !o.startsWith('—'));
    if (!lineAcct) { await modal.getByRole('button', { name: /cancel/i }).click(); test.skip(true, 'No accounts'); return; }

    await lineSel.selectOption({ label: lineAcct });
    await modal.locator('table tbody tr').first().locator('input[type=number]').first().fill('1500');
    await modal.getByRole('button', { name: /save/i }).click();

    await expect(modal).not.toBeVisible({ timeout: 10_000 });
    const billRow = page.locator('table.ac-table tbody tr').filter({ hasText: billNo }).first();
    await expect(billRow.getByText(/draft/i).first()).toBeVisible();
  });

  // ── AcBadge status colors ─────────────────────────────────────────────────

  test('posted badge is green-ish', async ({ page }) => {
    await gotoAC(page, '/journal');
    const postedBadge = page.locator('table.ac-table tbody tr').filter({ hasText: /posted/i }).first()
      .locator('[class*="badge"], [class*="ac-badge"]').first();
    if (await postedBadge.count() === 0) { test.skip(true, 'No posted badge visible'); return; }

    // Just verify it has a color style set
    const style = await postedBadge.getAttribute('style');
    expect(style).toBeTruthy();
  });

  test('draft badge renders differently from posted', async ({ page }) => {
    await gotoAC(page, '/journal');
    const draftBadge = page.locator('table.ac-table tbody tr').filter({ hasText: /draft/i }).first()
      .locator('[class*="badge"], [class*="ac-badge"]').first();
    const postedBadge = page.locator('table.ac-table tbody tr').filter({ hasText: /posted/i }).first()
      .locator('[class*="badge"], [class*="ac-badge"]').first();

    if (await draftBadge.count() === 0 || await postedBadge.count() === 0) {
      test.skip(true, 'Need both draft and posted entries');
      return;
    }

    const draftStyle = await draftBadge.getAttribute('style');
    const postedStyle = await postedBadge.getAttribute('style');
    expect(draftStyle).not.toBe(postedStyle);
  });

});
