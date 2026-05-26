/**
 * Shared helpers for the accounting E2E test suite.
 */
import { Page, expect } from '@playwright/test';

/** Module slug from env or default. All accounting URLs are /{MODULE}/accounting/premium/... */
export const MODULE = process.env.TEST_MODULE ?? 'demo';

/** Prefix for all accounting premium routes. */
export const AC = `/${MODULE}/accounting/premium`;

// ─── Navigation helpers ──────────────────────────────────────────────────────

/** Navigate to an accounting sub-page and wait for networkidle. */
export async function gotoAC(page: Page, sub = '') {
  await page.goto(`${AC}${sub}`);
  await page.waitForLoadState('networkidle');
}

// ─── Form helpers ────────────────────────────────────────────────────────────

/** Fill a labeled input by its visible label text (case-insensitive). */
export async function fillField(page: Page, label: string | RegExp, value: string) {
  const field = page.getByLabel(label);
  await field.fill(value);
}

/** Select an option in a <select> by visible text. */
export async function selectOption(page: Page, label: string | RegExp, text: string) {
  await page.getByLabel(label).selectOption({ label: text });
}

// ─── AcUI selectors ──────────────────────────────────────────────────────────

/**
 * Returns the Nth journal line row (0-based) in the new-entry table.
 * Looks for rows inside the ac-table in the journal new-entry form.
 */
export function lineRow(page: Page, idx: number) {
  return page.locator('table.ac-table tbody tr').nth(idx);
}

/** Set debit value on a journal line row. */
export async function setDebit(page: Page, rowIdx: number, amount: string) {
  await lineRow(page, rowIdx).locator('input[type=number]').nth(0).fill(amount);
}

/** Set credit value on a journal line row. */
export async function setCredit(page: Page, rowIdx: number, amount: string) {
  await lineRow(page, rowIdx).locator('input[type=number]').nth(1).fill(amount);
}

/** Pick account in a journal line row by its option text. */
export async function pickAccount(page: Page, rowIdx: number, accountText: string) {
  await lineRow(page, rowIdx).locator('select').selectOption({ label: accountText });
}

// ─── Assertion helpers ───────────────────────────────────────────────────────

/** Assert an AcAlert with type="success" is visible containing text. */
export async function expectSuccess(page: Page, text?: string | RegExp) {
  const alert = page.locator('[class*="ac-alert"]').filter({ hasText: text ?? /./s });
  await expect(alert).toBeVisible({ timeout: 8_000 });
}

/** Assert page contains text (or regex). */
export async function expectText(page: Page, text: string | RegExp) {
  await expect(page.getByText(text)).toBeVisible({ timeout: 8_000 });
}

/** Expect the URL to include a given substring. */
export async function expectURL(page: Page, fragment: string) {
  await expect(page).toHaveURL(new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

// ─── Modal helpers ───────────────────────────────────────────────────────────

/** Close the currently open AcModal via the × button. */
export async function closeModal(page: Page) {
  await page.locator('[class*="ac-modal"] button[aria-label="Close"], [class*="ac-modal"] button:has-text("✕"), [class*="ac-modal"] button:has-text("Cancel")').first().click();
}
