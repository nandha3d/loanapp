/**
 * Shared E2E helpers for the LoanTrack web app (non-accounting modules).
 */
import { Page, expect } from '@playwright/test';

/** Module slug (appType). Dashboard routes are /{MODULE}/<page>. */
export const MODULE = process.env.TEST_MODULE ?? 'microlending';

/** Build a module-scoped path: m('/loans') → /microlending/loans */
export const m = (sub = '') => `/${MODULE}${sub}`;

/** Navigate to a module page and settle. */
export async function goto(page: Page, sub = '') {
  await page.goto(m(sub));
  await page.waitForLoadState('networkidle');
}

/** Fill an input found by its visible label. */
export async function fill(page: Page, label: string | RegExp, value: string) {
  await page.getByLabel(label).first().fill(value);
}

/** Select an <option> by visible text in a labeled <select>. */
export async function select(page: Page, label: string | RegExp, text: string | RegExp) {
  await page.getByLabel(label).first().selectOption({ label: text as any });
}

/** Click a button by accessible name. */
export async function click(page: Page, name: string | RegExp) {
  await page.getByRole('button', { name }).first().click();
}

/** Assert visible text anywhere on the page. */
export async function seeText(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible();
}

/** Assert a success toast / alert appears. */
export async function seeSuccess(page: Page, text?: string | RegExp) {
  const toast = page.locator('[role="status"], [class*="toast"], [class*="alert"], [class*="success"]')
    .filter({ hasText: text ?? /[\s\S]/ });
  await expect(toast.first()).toBeVisible({ timeout: 10_000 });
}

/** Assert URL matches a fragment (escaped). */
export async function atUrl(page: Page, fragment: string) {
  await expect(page).toHaveURL(new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

/** A clean (logged-out) context page — for auth-guard tests. */
export async function anonPage(browser: import('@playwright/test').Browser) {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  return { page: await ctx.newPage(), ctx };
}

/** Unique suffix so repeated runs don't collide on unique fields. */
export const uniq = () => Date.now().toString().slice(-6);

/** yyyy-mm-dd for <input type="date"> (local date, not UTC). */
function dateInputValue(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A random 10-digit phone starting with 9. */
export const randomPhone = () => `9${Math.floor(100000000 + Math.random() * 899999999)}`.slice(0, 10);

/**
 * Create a customer via the UI form. Returns the new customer's URL code.
 * Picks the first real route/agent option (index 0 is the placeholder).
 */
export async function createCustomer(page: Page, name: string, phone: string): Promise<string> {
  await goto(page, '/customers/new');
  await page.locator('[name="name"]').first().fill(name);
  await page.locator('[name="phone"]').first().fill(phone);
  await page.locator('[name="address"]').first().fill('12 Test Street, Gobi').catch(() => {});
  await page.locator('[name="routeId"]').first().selectOption({ index: 1 }).catch(() => {});
  await page.locator('[name="agentId"]').first().selectOption({ index: 1 }).catch(() => {});
  const pref = page.locator('[name="preferredCollectionTime"]').first();
  if (await pref.count()) await pref.selectOption('morning').catch(() => {});
  await page.getByRole('button', { name: /save|register|create|submit/i }).first().click();
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/\/customers\//);
  return decodeURIComponent(page.url().match(/\/customers\/([^/?#]+)/)?.[1] ?? '');
}

/**
 * Create a DAILY loan (start TODAY → instalment #1 due today) for the named
 * customer. Selects the exact customer by matching the option text, so it never
 * lands on the wrong borrower. Returns the new loanCode.
 */
export async function createDailyLoan(
  page: Page,
  customerName: string,
  opts: { principal?: string; tenure?: string } = {},
): Promise<string> {
  await goto(page, '/loans/new');
  const sel = page.locator('[name="customerId"]').first();
  await expect(sel).toBeVisible();
  // Option text is "CODE — Name (Route)"; grab the value for OUR customer.
  const value = await page
    .locator('[name="customerId"] option', { hasText: customerName })
    .first()
    .getAttribute('value')
    .catch(() => null);
  if (value) await sel.selectOption(value);
  else await sel.selectOption({ index: 1 }).catch(() => {});
  await page.locator('[name="principal"]').first().fill(opts.principal ?? '10000');
  await page.locator('[name="tenure"]').first().fill(opts.tenure ?? '20');
  await page.locator('[name="deduction"]').first().fill('10').catch(() => {});
  await page.locator('[name="frequency"]').first().selectOption('daily').catch(() => {});
  await page.locator('[name="startDate"]').first().fill(dateInputValue()).catch(() => {});
  await page.locator('[name="voucherRef"]').first().fill(`V-${uniq()}-${Math.floor(Math.random() * 1000)}`).catch(() => {});
  await page.getByRole('button', { name: /create|save|submit|disburse/i }).first().click();
  // createLoan is a server action that redirects to /loans/<code> via an RPC
  // round-trip. Wait for that navigation to LAND — reading the URL right after
  // networkidle races the client-side redirect and still sees /loans/new.
  await page.waitForURL(/\/loans\/(?!new(?:$|[/?#]))[^/?#]+/, { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  const code = decodeURIComponent(page.url().match(/\/loans\/([^/?#]+)/)?.[1] ?? '');
  if (code === 'new' || code === '') {
    // Still on the form → createLoan returned an error. Surface it so the
    // failure message is actionable instead of a bare "expected not 'new'".
    const banner = await page
      .locator('[style*="--danger"], [class*="danger"], [role="alert"]')
      .first()
      .innerText()
      .catch(() => '');
    throw new Error(`Loan creation did not navigate (stayed on /loans/new). Banner: "${banner.trim()}"`);
  }
  return code;
}

/**
 * The collection-row "Pay" button. Its accessible name is "payments Pay" — the
 * material-icon ligature ("payments") is rendered text and precedes the label,
 * so an exact /^pay$/ match never hits. Match the whole word instead, which
 * also excludes "Submit Payment" (no \bpay\b boundary inside "Payment").
 */
export function payButton(page: Page) {
  return page.getByRole('button', { name: /\bpay\b/i });
}
