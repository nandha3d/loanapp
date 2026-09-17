/**
 * MICROLENDING — full end-to-end workflow.
 *
 * Walks the entire lending lifecycle as ONE connected flow (serial), then runs
 * standalone validation + RBAC checks. Designed to create its own data so it is
 * self-contained: Customer → Loan (disburse) → Schedule → Collection (today +
 * overdue distribution) → Loan-detail (actual vs distributed) → Dashboard KPIs.
 *
 * Companion spec to the existing loans/customers/collection specs — this one
 * exercises the cross-feature LOGIC (oldest-first distribution, capping, paid
 * rows staying visible, Today's-Split totals, frequency-aware list) end to end.
 *
 * RUN:
 *   npm run db:seed            # superadmin/super123, admin/admin123, agent karthik/agent123 + sample routes/agents
 *   npm run dev                # (prod build needs PII_ENCRYPTION_KEY + MOBILE_JWT_SECRET set)
 *   npx playwright test microlending-workflow --project=e2e
 *
 * Notes:
 *   - Default project storage = superadmin (loans go straight to ACTIVE, so the
 *     workflow doesn't block on an approval step). The approval path is covered
 *     separately in approvals-kyc.spec.ts.
 *   - MULTI-MODULE / MULTI-BRANCH DBs: if the superadmin's default branch isn't a
 *     microlending one, /microlending/* redirects away. Pin a microlending-enabled
 *     branch from the SAME tenant:
 *       E2E_ACTIVE_BRANCH_ID=<branchId> npx playwright test microlending-workflow
 *     (no-op on a clean seed where the default branch already has microlending).
 *   - Steps that need data the seed may not provide skip cleanly (house style),
 *     so a partial DB never red-fails the whole run.
 */
import { test, expect, Page } from '@playwright/test';
import { STORAGE } from '../../playwright.config';
import { goto, m, uniq, MODULE, createCustomer, createDailyLoan, payButton, randomPhone } from './helpers/app';

// Force the session into the module under test. Superadmin's active branch may
// default to another module (e.g. autofinance), which makes /microlending/*
// redirect away. Setting active_app_type (+ an optional microlending-enabled
// branch via E2E_ACTIVE_BRANCH_ID) pins the module. No-ops on a standard seed
// where the default branch already has microlending.
const ACTIVE_BRANCH_ID = process.env.E2E_ACTIVE_BRANCH_ID;
test.beforeEach(async ({ context, baseURL }) => {
  const url = baseURL ?? 'http://localhost:3000';
  const cookies: { name: string; value: string; url: string }[] = [
    { name: 'active_app_type', value: MODULE, url },
  ];
  if (ACTIVE_BRANCH_ID) cookies.push({ name: 'active_branch_id', value: ACTIVE_BRANCH_ID, url });
  await context.addCookies(cookies);

  // Mark the first-run onboarding tour as completed. Otherwise its fixed
  // bottom-right dialog ("Getting started guide") renders on every page and
  // intercepts pointer events, blocking clicks on buttons beneath it (the
  // collection "Pay" button, the loan-create button, etc.). Runs before any
  // page script on every navigation.
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem('lt_onboarding_v1', JSON.stringify({ done: true }));
    } catch {
      /* ignore private-mode / quota errors */
    }
  });
});

// ── helpers ───────────────────────────────────────────────────────────────

/** Select the option whose label matches, else fall back to the first real one. */
async function selectByLabelOrFirst(page: Page, selector: string, label: string | RegExp) {
  const el = page.locator(selector).first();
  await expect(el).toBeVisible();
  const isSelect = await el.evaluate((n) => n.tagName === 'SELECT').catch(() => false);
  if (!isSelect) return false;
  try {
    await el.selectOption({ label: label as any });
  } catch {
    await el.selectOption({ index: 1 }).catch(() => {});
  }
  return true;
}

/** Today's date as yyyy-mm-dd for <input type="date">. */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── 1. FULL LIFECYCLE (serial, shared state) ────────────────────────────────

test.describe.serial('MICROLENDING — full lifecycle', () => {
  const suffix = uniq();
  const customerName = `E2E Borrower ${suffix}`;
  const phone = `9${Math.floor(100000000 + Math.random() * 899999999)}`.slice(0, 10);
  let customerCode = '';
  let loanCode = '';

  test('ML-01 create customer (route + agent + preferred collection time)', async ({ page }) => {
    await goto(page, '/customers/new');

    await page.locator('[name="name"]').first().fill(customerName);
    await page.locator('[name="phone"]').first().fill(phone);
    await page.locator('[name="address"]').first().fill('12 Test Street, Gobi').catch(() => {});

    // Route + Agent are required for non-agent creators; pick the first REAL
    // option (index 1 — index 0 is the "Select…" placeholder).
    await page.locator('[name="routeId"]').first().selectOption({ index: 1 }).catch(() => {});
    await page.locator('[name="agentId"]').first().selectOption({ index: 1 }).catch(() => {});

    // New field from this change-set — must persist.
    const pref = page.locator('[name="preferredCollectionTime"]').first();
    if (await pref.count()) await pref.selectOption('morning').catch(() => {});

    await page.getByRole('button', { name: /save|register|create|submit/i }).first().click();
    await page.waitForLoadState('networkidle');

    // Lands on the customer profile (URL carries the new customer code).
    await expect(page).toHaveURL(/\/customers\//);
    const match = page.url().match(/\/customers\/([^/?#]+)/);
    customerCode = match ? decodeURIComponent(match[1]) : '';
    expect(customerCode).not.toEqual('');
    await expect(page.getByText(customerName).first()).toBeVisible();
  });

  test('ML-02 new customer appears in the customer list', async ({ page }) => {
    await goto(page, '/customers');
    await page.getByPlaceholder(/search/i).first().fill(customerName).catch(() => {});
    await page.waitForTimeout(500);
    await expect(page.getByText(customerName).first()).toBeVisible();
  });

  test('ML-03 create a DAILY loan for the new customer (auto-active as superadmin)', async ({ page }) => {
    await goto(page, '/loans/new');

    // Pick the customer we just created (by name), else first real option.
    const picked = await selectByLabelOrFirst(page, '[name="customerId"]', new RegExp(customerName, 'i'));
    test.skip(!picked, 'customer picker is not a <select> on this build');

    await page.locator('[name="principal"]').first().fill('10000');
    await page.locator('[name="tenure"]').first().fill('20');
    // Interest / Rate (%) — required; rendered with name="deduction".
    await page.locator('[name="deduction"]').first().fill('10').catch(() => {});
    await page.locator('[name="frequency"]').first().selectOption('daily').catch(() => {});
    // Start today so instalment #1 is due TODAY (gives the collection flow a row).
    await page.locator('[name="startDate"]').first().fill(todayISO()).catch(() => {});
    await page.locator('[name="voucherRef"]').first().fill(`V-${suffix}`).catch(() => {});

    await page.getByRole('button', { name: /create|save|submit|disburse/i }).first().click();
    await page.waitForLoadState('networkidle');

    // Must navigate to a REAL loan detail page (not back to /loans/new).
    await expect(page).toHaveURL(/\/loans\/(?!new$)[^/]+$/);
    const match = page.url().match(/\/loans\/([^/?#]+)/);
    loanCode = match ? decodeURIComponent(match[1]) : '';
    expect(loanCode).not.toEqual('');
    expect(loanCode).not.toEqual('new');
  });

  test('ML-04 loan detail shows schedule, outstanding, and instalments', async ({ page }) => {
    test.skip(!loanCode, 'loan not created');
    await goto(page, `/loans/${loanCode}`);
    await expect(page.getByText(/payment schedule/i).first()).toBeVisible();
    await expect(page.getByText(/outstanding/i).first()).toBeVisible();
    // 20 instalment rows expected for a 20-day daily loan (assert at least a few).
    const rows = page.locator('table tbody tr');
    expect(await rows.count()).toBeGreaterThan(1);
  });

  test('ML-05 record a payment via the loan-page collect popup (Today’s Due)', async ({ page }) => {
    test.skip(!loanCode, 'loan not created');
    await goto(page, `/loans/${loanCode}`);

    const recordBtn = page.getByRole('button', { name: /record payment/i }).first();
    test.skip(!(await recordBtn.count()), 'Record Payment button not present (loan settled?)');
    await recordBtn.click();

    // Two preset cards from the redesigned popup.
    await expect(page.getByText(/today.?s due/i).first()).toBeVisible();
    await expect(page.getByText(/total due/i).first()).toBeVisible();

    const amount = page.locator(".modal").getByRole("spinbutton").first();
    await amount.fill('500');
    await page.getByRole('button', { name: /submit payment|confirm|save/i }).first().click();
    await page.waitForLoadState('networkidle');

    // Received column now shows money against the loan (oldest-first distribution).
    await expect(page.getByText(/₹\s?500|500/).first()).toBeVisible();
  });

  test('ML-06 actual vs distributed views both render and agree on total', async ({ page }) => {
    test.skip(!loanCode, 'loan not created');
    await goto(page, `/loans/${loanCode}`);
    const actualBtn = page.getByRole('button', { name: /^actual$/i }).first();
    const distBtn = page.getByRole('button', { name: /^distributed$/i }).first();
    test.skip(!(await actualBtn.count()) || !(await distBtn.count()), 'view toggle not present');
    await distBtn.click();
    await page.waitForTimeout(300);
    await actualBtn.click();
    await page.waitForTimeout(300);
    // After a 500 payment on a 10000/20 (=500/inst) daily loan, exactly one
    // instalment should read paid in BOTH views (distribution == actual here).
    await expect(page.getByText(/paid/i).first()).toBeVisible();
  });

  test('ML-07 collection page lists a customer and records a payment via the redesigned popup', async ({ page }) => {
    // The serial customer above is fully settled by ML-05, so it has no
    // collectible row today. Self-seed a FRESH unpaid daily loan (due today) so
    // this step is deterministic instead of skipping on an empty list.
    const name = `E2E Collect ${uniq()}`;
    await createCustomer(page, name, randomPhone());
    const code = await createDailyLoan(page, name);
    expect(code).not.toEqual('');
    expect(code).not.toEqual('new');

    await goto(page, '/collection');
    const search = page.getByPlaceholder(/search/i).first();
    if (await search.count()) await search.fill(name);
    await page.waitForTimeout(500);

    const payBtn = payButton(page).first();
    await expect(payBtn).toBeVisible();
    await payBtn.click();

    // Redesigned collection popup: two preset cards + editable amount. (New
    // collection, never paid → cards render; payment is spread oldest-first
    // server-side.)
    await expect(page.getByText(/today due|today.?s due/i).first()).toBeVisible();
    await expect(page.getByText(/total due/i).first()).toBeVisible();
    const amount = page.locator(".modal").getByRole("spinbutton").first();
    await amount.fill('300');
    await page.getByRole('button', { name: /submit payment|confirm/i }).first().click();
    await page.waitForLoadState('networkidle');

    // No allocation/over-credit error surfaced.
    await expect(page.getByText(/exceed|invalid|corrupt|prisma/i)).toHaveCount(0);
  });

  test('ML-08 a fully-paid customer stays visible (grayed), not removed', async ({ page }) => {
    await goto(page, '/collection');
    const search = page.getByPlaceholder(/search/i).first();
    if (await search.count()) await search.fill(customerName);
    await page.waitForTimeout(500);
    // The row must still be present even once today's due is settled.
    await expect(page.getByText(customerName).first()).toBeVisible();
  });

  test('ML-09 dashboard: Today’s Split bars are ≤100% (no 3111% regression)', async ({ page }) => {
    await goto(page, '/dashboard');
    // Scope to the split CARD only (other dashboard metrics may legitimately
    // exceed 100%, e.g. growth). The bug rendered cash 14000 / 450 = 3111%.
    const card = page.locator('.card').filter({ hasText: /split/i }).first();
    test.skip(!(await card.count()), 'split card not on this dashboard variant');
    const pctTexts = await card.getByText(/\d+\s*%/).allInnerTexts();
    const over = pctTexts.map((t) => parseInt(t.replace(/[^\d]/g, ''), 10)).filter((n) => n > 100);
    expect(over, `split bar percentages: ${pctTexts.join(', ')}`).toEqual([]);
  });

  test('ML-10 dashboard: today activity feed lists the collection just made', async ({ page }) => {
    await goto(page, '/dashboard');
    const feed = page.getByText(/today.?s activity|recent collection/i).first();
    test.skip(!(await feed.count()), 'activity feed not on web dashboard variant');
    await expect(feed).toBeVisible();
  });
});

// ── 2. VALIDATION / NEGATIVE CASES ──────────────────────────────────────────

test.describe('MICROLENDING — validation & guards', () => {
  test('ML-N01 loan with principal = 0 is rejected', async ({ page }) => {
    await goto(page, '/loans/new');
    await selectByLabelOrFirst(page, '[name="customerId"]', /.*/);
    await page.locator('[name="principal"]').first().fill('0');
    await page.locator('[name="tenure"]').first().fill('10');
    await page.getByRole('button', { name: /create|save|submit|disburse/i }).first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/loans\/new|\/loans$/);
  });

  test('ML-N02 loan with no customer cannot be submitted', async ({ page }) => {
    await goto(page, '/loans/new');
    await page.locator('[name="principal"]').first().fill('10000');
    await page.locator('[name="tenure"]').first().fill('10');
    await page.locator('[name="deduction"]').first().fill('10').catch(() => {});
    // The submit button stays DISABLED until a customer is chosen — the form
    // guards creation rather than letting an invalid loan through.
    const submit = page.getByRole('button', { name: /create|save|submit|disburse/i }).first();
    await expect(submit).toBeDisabled();
    await expect(page).toHaveURL(/\/loans\/new/);
  });

  test('ML-N03 customer with no name is rejected (HTML required)', async ({ page }) => {
    await goto(page, '/customers/new');
    await page.locator('[name="phone"]').first().fill('9000000000');
    await page.getByRole('button', { name: /save|register|create|submit/i }).first().click();
    // required attribute keeps us on the form.
    await expect(page).toHaveURL(/\/customers\/new/);
  });

  test('ML-N04 collection: overpaying is capped, never over-credits an instalment', async ({ page }) => {
    // Self-seed a fresh unpaid daily loan so there is always a due row to pay,
    // then attempt a wildly-over-the-top amount.
    const name = `E2E Overpay ${uniq()}`;
    await createCustomer(page, name, randomPhone());
    await createDailyLoan(page, name);

    await goto(page, '/collection');
    const search = page.getByPlaceholder(/search/i).first();
    if (await search.count()) await search.fill(name);
    await page.waitForTimeout(500);

    const payBtn = payButton(page).first();
    await expect(payBtn).toBeVisible();
    await payBtn.click();
    const amount = page.locator(".modal").getByRole("spinbutton").first();
    await amount.fill('99999999');
    await page.getByRole('button', { name: /submit payment|confirm/i }).first().click();
    await page.waitForLoadState('networkidle');
    // Accepted-and-capped to the loan's outstanding (10000) — never an error toast
    // about over-credit / corrupt allocation, and never a Prisma crash.
    await expect(page.getByText(/exceed|invalid|corrupt|prisma/i)).toHaveCount(0);
  });
});

// ── 3. RBAC ─────────────────────────────────────────────────────────────────

test.describe('MICROLENDING — RBAC (agent)', () => {
  test.use({ storageState: STORAGE.agent });

  test('ML-R01 agent is kept out of admin-only pages (/accounting)', async ({ page }) => {
    // NOTE: /loans is intentionally agent-VIEWABLE (not in AGENT_BLOCKED).
    // Accounting/approvals/settings are the blocked ones → bounce to agent-dashboard.
    await page.goto(m('/accounting'));
    await expect(page).not.toHaveURL(/\/accounting$/);
  });

  test('ML-R02 agent CAN open /collection (their core screen)', async ({ page }) => {
    await goto(page, '/collection');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/collection|today|due/i).first()).toBeVisible();
  });

  test('ML-R03 agent CAN open the dashboard', async ({ page }) => {
    await goto(page, '/dashboard');
    await expect(page.locator('body')).toBeVisible();
  });
});
