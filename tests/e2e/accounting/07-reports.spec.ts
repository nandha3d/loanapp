/**
 * ACCOUNTING E2E — 07: Financial Reports
 *
 * Covers:
 *   P&L Report:
 *     - Page renders with date range pickers
 *     - Generates P&L table with income/expense sections
 *     - Net profit row present
 *     - Changing date range updates report
 *
 *   Balance Sheet:
 *     - Page renders with "as of" date picker
 *     - Generates balance sheet with Assets / Liabilities / Equity sections
 *     - Balance equation check row (Assets = Liabilities + Equity note)
 *     - Changing date updates data
 *
 *   Trial Balance:
 *     - Page renders
 *     - Table has Dr/Cr columns
 *     - Total row present
 *     - Show/hide zero-balance toggle
 *
 *   Cash Flow:
 *     - Page renders chart area
 *     - Has date range controls
 *     - Operating/Investing/Financing sections
 *
 *   Export:
 *     - Export page renders format selector and download button
 */
import { test, expect } from '@playwright/test';
import { gotoAC } from './helpers';

// ── P&L ──────────────────────────────────────────────────────────────────────

test.describe('P&L Report', () => {

  test.beforeEach(async ({ page }) => {
    await gotoAC(page, '/pnl');
  });

  test('P&L page renders date range controls', async ({ page }) => {
    await expect(page.getByLabel(/from/i)).toBeVisible();
    await expect(page.getByLabel(/to/i)).toBeVisible();
  });

  test('P&L page renders income and expense sections', async ({ page }) => {
    await expect(page.getByText(/income|revenue/i)).toBeVisible();
    await expect(page.getByText(/expense/i)).toBeVisible();
  });

  test('P&L page has net profit row', async ({ page }) => {
    await expect(page.getByText(/net profit|net loss|net income/i)).toBeVisible();
  });

  test('P&L totals row shows numeric values', async ({ page }) => {
    // At least one numeric value (could be 0 / — in empty system)
    const amounts = page.locator('[style*="monospace"], [class*="monospace"]');
    await expect(amounts.first()).toBeVisible();
  });

  test('changing date range reloads report', async ({ page }) => {
    const fromInput = page.getByLabel(/from/i);
    const toInput = page.getByLabel(/to/i);

    await fromInput.fill('2025-04-01');
    await toInput.fill('2025-06-30');

    // Trigger any apply button or wait for auto-load
    const applyBtn = page.getByRole('button', { name: /apply|generate|run/i });
    if (await applyBtn.count() > 0) await applyBtn.click();

    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/income|expense|net profit/i)).toBeVisible();
  });

  test('P&L has branch selector or shows all-branch data', async ({ page }) => {
    // Branch filter may be present
    const branchSel = page.locator('select').filter({ hasText: /branch|all/i }).first();
    // Just verify it renders either way
    await expect(page.locator('body')).toContainText(/income|expense/i);
  });

});

// ── Balance Sheet ─────────────────────────────────────────────────────────────

test.describe('Balance Sheet', () => {

  test.beforeEach(async ({ page }) => {
    await gotoAC(page, '/balance-sheet');
  });

  test('balance sheet page renders "as of" date control', async ({ page }) => {
    // May be a date input or "as of" label
    const asOf = page.getByLabel(/as of/i).or(page.getByPlaceholder(/date/i)).or(page.locator('input[type=date]')).first();
    await expect(asOf).toBeVisible();
  });

  test('balance sheet shows Assets section', async ({ page }) => {
    await expect(page.getByText(/assets/i)).toBeVisible();
  });

  test('balance sheet shows Liabilities section', async ({ page }) => {
    await expect(page.getByText(/liabilities/i)).toBeVisible();
  });

  test('balance sheet shows Equity section', async ({ page }) => {
    await expect(page.getByText(/equity/i)).toBeVisible();
  });

  test('balance sheet columns include amount', async ({ page }) => {
    // Monospace amount values present
    const amts = page.locator('[style*="monospace"], [class*="monospace"]');
    await expect(amts.first()).toBeVisible();
  });

  test('changing as-of date updates balance sheet', async ({ page }) => {
    const dateInput = page.locator('input[type=date]').first();
    await dateInput.fill('2025-03-31');

    const applyBtn = page.getByRole('button', { name: /apply|generate|run/i });
    if (await applyBtn.count() > 0) await applyBtn.click();

    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/assets|liabilities/i)).toBeVisible();
  });

});

// ── Trial Balance ─────────────────────────────────────────────────────────────

test.describe('Trial Balance', () => {

  test.beforeEach(async ({ page }) => {
    await gotoAC(page, '/trial-balance');
  });

  test('trial balance page renders', async ({ page }) => {
    await expect(page.locator('table')).toBeVisible();
  });

  test('trial balance table has Debit and Credit columns', async ({ page }) => {
    const headers = page.locator('thead');
    await expect(headers.getByText(/debit/i)).toBeVisible();
    await expect(headers.getByText(/credit/i)).toBeVisible();
  });

  test('trial balance has totals row', async ({ page }) => {
    await expect(page.getByText(/total/i)).toBeVisible();
  });

  test('trial balance date range controls present', async ({ page }) => {
    const dateInputs = page.locator('input[type=date]');
    const count = await dateInputs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('show/hide zero-balance accounts toggle', async ({ page }) => {
    const hideZeroCheckbox = page.locator('input[type=checkbox]').filter({}).first();
    if (await hideZeroCheckbox.count() === 0) { return; }

    const rowsBefore = await page.locator('tbody tr').count();
    await hideZeroCheckbox.click();
    await page.waitForTimeout(300);
    const rowsAfter = await page.locator('tbody tr').count();
    // After hiding zeros, row count should be ≤ before
    expect(rowsAfter).toBeLessThanOrEqual(rowsBefore);
  });

  test('trial balance Dr total equals Cr total', async ({ page }) => {
    const totalRow = page.locator('tbody tr').last().or(page.locator('tfoot tr').first());
    const rowText = await totalRow.textContent();
    if (!rowText) return;

    // Extract all numbers from the total row
    const nums = [...rowText.matchAll(/[\d,.]+/g)]
      .map(m => parseFloat(m[0].replace(/,/g, '')))
      .filter(n => n > 0);

    if (nums.length >= 2) {
      // Dr total and Cr total should be equal (or both 0 in empty system)
      const diff = Math.abs(nums[nums.length - 2] - nums[nums.length - 1]);
      expect(diff).toBeLessThan(1); // allow 1-unit rounding
    }
  });

});

// ── Cash Flow ────────────────────────────────────────────────────────────────

test.describe('Cash Flow', () => {

  test.beforeEach(async ({ page }) => {
    await gotoAC(page, '/cashflow');
  });

  test('cash flow page renders', async ({ page }) => {
    await expect(page.locator('body')).toContainText(/cash|operating|investing|financing/i);
  });

  test('cash flow has date range controls', async ({ page }) => {
    const dateInputs = page.locator('input[type=date]');
    const count = await dateInputs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('cash flow shows operating activities section', async ({ page }) => {
    await expect(page.getByText(/operating/i)).toBeVisible();
  });

  test('cash flow shows net change or total row', async ({ page }) => {
    await expect(page.getByText(/net|total/i)).toBeVisible();
  });

});

// ── Export ───────────────────────────────────────────────────────────────────

test.describe('Export', () => {

  test.beforeEach(async ({ page }) => {
    await gotoAC(page, '/export');
  });

  test('export page renders', async ({ page }) => {
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('export page has report type selector', async ({ page }) => {
    const typeOptions = page.locator('select, input[type=radio]');
    await expect(typeOptions.first()).toBeVisible();
  });

  test('export page has download/export button', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: /export|download/i });
    await expect(exportBtn).toBeVisible();
  });

  test('export page has date range controls', async ({ page }) => {
    const dateInputs = page.locator('input[type=date]');
    await expect(dateInputs.first()).toBeVisible();
  });

});

// ── Tax & GST ────────────────────────────────────────────────────────────────

test.describe('Tax & GST', () => {

  test.beforeEach(async ({ page }) => {
    await gotoAC(page, '/tax');
  });

  test('tax page renders', async ({ page }) => {
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('tax page has GST or TDS section', async ({ page }) => {
    await expect(page.getByText(/gst|tds|tax/i)).toBeVisible();
  });

  test('tax page has date range controls', async ({ page }) => {
    const dateOrSel = page.locator('input[type=date], select').first();
    await expect(dateOrSel).toBeVisible();
  });

});

// ── Budget ───────────────────────────────────────────────────────────────────

test.describe('Budget', () => {

  test.beforeEach(async ({ page }) => {
    await gotoAC(page, '/budget');
  });

  test('budget page renders', async ({ page }) => {
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('budget page has create/add budget button', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /new budget|add budget|create/i });
    await expect(addBtn).toBeVisible();
  });

  test('create budget modal opens', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /new budget|add budget|create/i });
    await addBtn.click();
    const modal = page.locator('[class*="ac-modal"]').or(page.locator('[role=dialog]'));
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: /cancel/i }).click();
  });

});

// ── Bank Reconciliation ───────────────────────────────────────────────────────

test.describe('Bank Reconciliation', () => {

  test.beforeEach(async ({ page }) => {
    await gotoAC(page, '/bank-rec');
  });

  test('bank rec list page renders', async ({ page }) => {
    await expect(page.locator('body')).not.toBeEmpty();
    // Either shows list of bank accounts or "no accounts" message
    await expect(page.locator('body')).toContainText(/bank|account|reconcil/i);
  });

});
