import { expect, test, type Page } from '@playwright/test';
import { closeDb, db, waitForRow } from './support/db';
import { api, loginApi } from './support/api';
import { loadState, patchState, runPhone } from './support/state';
import { ensureSession } from './support/session';
import { bodyText, gotoOk, mpath, setActiveBranch, waitForHydration } from './support/ui';

// Ordering comes from the runner (workers: 1, fullyParallel: false), not from
// serial mode, so one failure never blanks the cases that follow it.

test.afterAll(async () => {
  await closeDb();
});

const APP_TYPE = 'microlending';

/**
 * Phone number for a subject this execution must own outright.
 *
 * Approval cases need a row that is still pending; reusing the run's fixed
 * numbering hands them the row the previous execution already approved, and
 * the case then fails for a reason that has nothing to do with the app.
 */
function freshPhone(): string {
  const tail = String(Date.now() % 100000000).padStart(8, '0');
  return `9${tail}${Math.floor(Math.random() * 10)}`.slice(0, 10);
}

async function asAgentHq(page: Page) {
  const s = loadState();
  await ensureSession(page, 'agentHq', { username: s.tenantA.agentHq!.username, password: s.password });
  return s;
}

async function asAdmin(page: Page) {
  const s = loadState();
  await ensureSession(page, 'admin', { username: s.tenantA.admin!.username, password: s.password });
  return s;
}

/** Fill and submit the new-customer form. */
async function submitCustomer(
  page: Page,
  input: { name: string; phone: string; address?: string; aadhaar?: string; routeId?: string },
) {
  const alerts: string[] = [];
  page.on('dialog', async (d) => {
    alerts.push(d.message());
    await d.dismiss().catch(() => {});
  });

  await page.goto(mpath('/customers/new'), { waitUntil: 'domcontentloaded' });
  await waitForHydration(page, 'form');

  await page.locator('input[name="name"]').fill(input.name);
  await page.locator('input[name="phone"]').fill(input.phone);
  if (input.address) await page.locator('textarea[name="address"]').fill(input.address);
  if (input.aadhaar) await page.locator('input[name="aadharNumber"]').fill(input.aadhaar);

  const route = page.locator('select[name="routeId"]');
  if (input.routeId) {
    await route.selectOption(input.routeId);
  } else {
    const first = await route.locator('option').nth(1).getAttribute('value');
    if (first) await route.selectOption(first);
  }

  await page.locator('form button[type="submit"]').first().click();
  return alerts;
}

test('[ML-088] Route picker on the customer form offers only in-branch routes', async ({ page }) => {
  const s = loadState();
  await ensureSession(page, 'owner', { username: s.tenantA.owner.username, password: s.password });
  await setActiveBranch(page, s.tenantA.branches.hq!);
  await gotoOk(page, mpath('/customers/new'), 'new customer form (HQ)');

  const options = await page
    .locator('select[name="routeId"] option')
    .evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).textContent?.trim() ?? ''));

  expect(options.join(' '), 'the HQ route is offered').toContain(`R1-${s.runId}`);
  expect(options.join(' '), 'an Erode route must not be offered under HQ (SCOPE-16)').not.toContain(`R2-${s.runId}`);
});

test('[ML-150] Agent opens the new-customer form', async ({ page }) => {
  const s = await asAgentHq(page);
  await gotoOk(page, mpath('/customers/new'), 'new customer form');

  await expect(page.locator('input[name="name"]')).toBeVisible();
  await expect(page.locator('input[name="phone"]')).toBeVisible();
  await expect(page.locator('select[name="routeId"]')).toBeVisible();

  const routes = await page
    .locator('select[name="routeId"] option')
    .evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).textContent?.trim() ?? ''));
  expect(routes.join(' '), 'the agent’s own route is selectable').toContain(`R1-${s.runId}`);
});

test('[ML-151] Agent-created customer lands in pending_review', async ({ page }) => {
  const s = await asAgentHq(page);
  const name = `HQ Borrower ${s.runId}`;
  const phone = freshPhone();

  await submitCustomer(page, {
    name,
    phone,
    address: '12 Market Street, Erode',
    aadhaar: '432112345678',
    routeId: s.tenantA.routeHq!,
  });

  const customer = await waitForRow(
    () => db().customer.findFirst({ where: { tenantId: s.tenantA.id, phone } }),
    'the agent-created customer',
  );
  expect(customer.status, 'an agent without the bypass flag files for review').toBe('pending_review');

  patchState((state) => {
    state.tenantA.customerHq = customer.id;
  });
});

test('[ML-152] Customer is stamped with the branch of its route, not its author', async () => {
  const s = loadState();
  const customer = await db().customer.findUniqueOrThrow({ where: { id: s.tenantA.customerHq! } });
  expect(customer.branchId, 'the customer belongs to the route’s branch (SCOPE-7)').toBe(s.tenantA.branches.hq);
  expect(customer.routeId).toBe(s.tenantA.routeHq);
  expect(customer.agentId, 'the route’s primary agent collects from them').toBe(s.tenantA.agentHq!.id);
  expect(customer.appType).toBe(APP_TYPE);
});

test('[ML-160] Aadhaar is encrypted at rest', async () => {
  const s = loadState();
  const customer = await db().customer.findUniqueOrThrow({ where: { id: s.tenantA.customerHq! } });
  if (!customer.aadharNumber) {
    test.skip(true, 'no Aadhaar captured for this customer');
  }
  expect(customer.aadharNumber, 'the plaintext number must not sit in the column (SEC-1)').not.toBe('432112345678');
  expect(String(customer.aadharNumber).length, 'the stored value is a ciphertext, not 12 digits').toBeGreaterThan(12);
});

test('[ML-153] Pending customer appears in the admin approvals queue', async ({ page }) => {
  const s = await asAdmin(page);
  await gotoOk(page, mpath('/approvals'), 'approvals queue');

  const text = await bodyText(page);
  expect(text, 'the pending customer is queued for review').toContain(`hq borrower ${s.runId}`.toLowerCase());
});

test('[ML-154] Admin approval activates the customer', async ({ page }) => {
  const s = await asAdmin(page);
  await gotoOk(page, mpath('/approvals'), 'approvals queue');
  await waitForHydration(page, 'table');

  const row = page.locator('tr').filter({ hasText: `HQ Borrower ${s.runId}` }).first();
  await row.getByRole('button', { name: /approve/i }).click();

  await waitForRow(
    async () => {
      const c = await db().customer.findUnique({ where: { id: s.tenantA.customerHq! } });
      return c?.status === 'active' ? c : null;
    },
    'the customer to be activated',
  );
  const customer = await db().customer.findUniqueOrThrow({ where: { id: s.tenantA.customerHq! } });
  expect(customer.status).toBe('active');
});

test('[ML-155] Approve is a single click', async ({ page }) => {
  const s = await asAdmin(page);
  const phone = freshPhone();
  const name = `Single Click ${s.runId} ${phone.slice(-4)}`;

  // A pending customer of this execution's own, filed the way an agent files.
  const pending =
    (await db().customer.create({
      data: {
        tenantId: s.tenantA.id,
        branchId: s.tenantA.branches.hq!,
        routeId: s.tenantA.routeHq!,
        agentId: s.tenantA.agentHq!.id,
        customerCode: `SC-${phone.slice(-6)}`,
        name,
        phone,
        address: 'Approval bench',
        status: 'pending_review',
        appType: APP_TYPE,
      },
    }));

  await gotoOk(page, mpath('/approvals'), 'approvals queue');
  await waitForHydration(page, 'table');

  const row = page.locator('tr').filter({ hasText: name }).first();
  await row.getByRole('button', { name: /approve/i }).click();

  const approved = await waitForRow(
    async () => {
      const c = await db().customer.findUnique({ where: { id: pending.id } });
      return c?.status === 'active' ? c : null;
    },
    'a single-click approval to land',
  );
  expect(approved.status, 'one click is enough — no second confirmation').toBe('active');
});

test('[ML-156] Admin can reject a customer with notes', async ({ page }) => {
  const s = await asAdmin(page);
  const phone = freshPhone();
  const name = `Reject Me ${s.runId} ${phone.slice(-4)}`;

  const pending =
    (await db().customer.create({
      data: {
        tenantId: s.tenantA.id,
        branchId: s.tenantA.branches.hq!,
        routeId: s.tenantA.routeHq!,
        agentId: s.tenantA.agentHq!.id,
        customerCode: `RJ-${phone.slice(-6)}`,
        name,
        phone,
        address: 'Rejection bench',
        status: 'pending_review',
        appType: APP_TYPE,
      },
    }));

  await gotoOk(page, mpath('/approvals'), 'approvals queue');
  await waitForHydration(page, 'table');

  const row = page.locator('tr').filter({ hasText: name }).first();
  const reject = row.getByRole('button', { name: /reject|confirm/i }).first();
  await reject.click();
  // Rejection asks for confirmation because it denies someone else's request.
  await expect(reject).toContainText(/confirm/i, { timeout: 10_000 });
  await reject.click();

  const rejected = await waitForRow(
    async () => {
      const c = await db().customer.findUnique({ where: { id: pending.id } });
      return c && c.status !== 'pending_review' ? c : null;
    },
    'the rejection to land',
  );
  expect(rejected.status, 'a rejected registration is not active').not.toBe('active');
});

test('[ML-157] Admin-created customer is active immediately', async ({ page }) => {
  const s = await asAdmin(page);
  const phone = freshPhone();
  const name = `Admin Made ${s.runId} ${phone.slice(-4)}`;

  await submitCustomer(page, { name, phone, address: 'Admin desk', routeId: s.tenantA.routeHq! });

  const customer = await waitForRow(
    () => db().customer.findFirst({ where: { tenantId: s.tenantA.id, phone } }),
    'the admin-created customer',
  );
  expect(customer.status, 'an admin bypasses customer approval').toBe('active');
});

test('[ML-158] Customer codes follow the tenant prefix and never collide', async () => {
  const s = loadState();
  const customers = await db().customer.findMany({
    where: { tenantId: s.tenantA.id },
    select: { customerCode: true },
  });
  expect(customers.length).toBeGreaterThan(1);
  const codes = customers.map((c) => c.customerCode);
  expect(new Set(codes).size, 'customer codes are unique inside the tenant').toBe(codes.length);

  // Rows this suite inserts directly carry their own prefixes; only the codes
  // the application minted are evidence about the application's numbering.
  const generated = codes.filter((c) => !/^(SC|RJ|ER)-/.test(c));
  expect(generated.length, 'at least one code came from the app').toBeGreaterThan(0);
  for (const code of generated) {
    expect(code, 'generated codes carry the configured prefix').toMatch(/CUS/i);
  }
});

test('[ML-159] Duplicate customer phone within a tenant is refused', async ({ page }) => {
  const s = await asAdmin(page);
  const before = await db().customer.count({ where: { tenantId: s.tenantA.id } });
  const existing = await db().customer.findUniqueOrThrow({ where: { id: s.tenantA.customerHq! } });
  const phone = existing.phone; // already used by the HQ borrower

  const alerts = await submitCustomer(page, {
    name: `Clash ${s.runId}`,
    phone,
    address: 'Duplicate bench',
    routeId: s.tenantA.routeHq!,
  });
  await page.waitForTimeout(3_000);

  expect(await db().customer.count({ where: { tenantId: s.tenantA.id } }), 'no duplicate row').toBe(before);
  expect(alerts.join(' ') + (await bodyText(page)), 'the clash is reported').toMatch(
    /already|exists|duplicate|same phone/i,
  );
});

test('[ML-162] Customer list is branch-scoped for staff', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);
  const phone = runPhone(s.runId, 25);

  const erodeCustomer =
    (await db().customer.findFirst({ where: { tenantId: s.tenantA.id, phone } })) ??
    (await db().customer.create({
      data: {
        tenantId: s.tenantA.id,
        branchId: s.tenantA.branches.erode!,
        routeId: s.tenantA.routeErode!,
        agentId: s.tenantA.agentErode!.id,
        customerCode: `ER-${s.runId}`,
        name: `Erode Borrower ${s.runId}`,
        phone,
        address: 'Erode market',
        status: 'active',
        appType: APP_TYPE,
      },
    }));
  patchState((state) => {
    state.tenantA.customerErode = erodeCustomer.id;
  });

  const listOf = async (branchId: string) => {
    const res = await api.get('/api/v1/customers?limit=100', { token: owner.token, branchId });
    const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
    return rows.map((c: any) => c.id);
  };

  const hq = await listOf(s.tenantA.branches.hq!);
  const erode = await listOf(s.tenantA.branches.erode!);

  expect(hq, 'HQ lists its own customer').toContain(s.tenantA.customerHq);
  expect(hq, 'HQ must not list the Erode customer').not.toContain(erodeCustomer.id);
  expect(erode, 'Erode lists its own customer').toContain(erodeCustomer.id);
  expect(erode, 'Erode must not list the HQ customer').not.toContain(s.tenantA.customerHq);
});

test('[ML-161] Agent sees only their own customers', async () => {
  const s = loadState();
  const agent = await loginApi(s.tenantA.agentHq!.username, s.password);
  const res = await api.get('/api/v1/customers?limit=100', { token: agent.token });
  const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
  const ids = rows.map((c: any) => c.id);

  expect(ids, 'the agent sees the customer on their own route').toContain(s.tenantA.customerHq);
  expect(ids, 'the agent must not see another branch’s customer').not.toContain(s.tenantA.customerErode);
});

test('[ML-163] Agent cannot edit a customer', async ({ page }) => {
  const s = await asAgentHq(page);
  // First hit of this route can be a cold compile in dev; one retry keeps a
  // slow build from reading as a permission failure.
  await page
    .goto(`${mpath('/customers/new')}?edit=${s.tenantA.customerHq}`, { waitUntil: 'domcontentloaded' })
    .catch(async () => {
      await page.goto(`${mpath('/customers/new')}?edit=${s.tenantA.customerHq}`, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
    });

  expect(page.url(), 'the agent is redirected away from the edit form').not.toContain('edit=');

  // The web form blocks the agent. The JWT path must refuse it too — a
  // capability an agent does not have on one surface is not a capability.
  const original = await db().customer.findUniqueOrThrow({ where: { id: s.tenantA.customerHq! } });
  const agent = await loginApi(s.tenantA.agentHq!.username, s.password);
  const res = await api.patch(
    `/api/v1/customers/${s.tenantA.customerHq}`,
    { name: 'Renamed By Agent' },
    { token: agent.token },
  );
  const after = await db().customer.findUniqueOrThrow({ where: { id: s.tenantA.customerHq! } });

  // Put the row back before asserting, so later cases read the original name.
  if (after.name !== original.name) {
    await db().customer.update({ where: { id: original.id }, data: { name: original.name } });
  }

  expect(after.name, 'an agent must not be able to rename a customer').toBe(original.name);
  expect([401, 403, 404, 405], `an agent edit must be refused, got ${res.status}`).toContain(res.status);
});

test('[ML-164] A customer id from another tenant returns 404, not 403', async () => {
  const s = loadState();
  const owner = await loginApi(s.tenantA.owner.username, s.password);

  // A real row that belongs to tenant B.
  const foreign = await db().customer.findFirst({ where: { tenantId: s.tenantB.id } });
  const foreignId = foreign?.id ?? 'cl00000000000000000000000';

  const res = await api.get(`/api/v1/customers/${foreignId}`, { token: owner.token });
  expect(res.status, 'out-of-scope reads answer 404, never 403 (API-5)').toBe(404);
});

test('[ML-404] Script payloads in text fields are stored inertly', async ({ page }) => {
  const s = await asAdmin(page);
  const phone = runPhone(s.runId, 26);
  const payload = `<script>window.__xss=1</script>${s.runId}`;

  const existing = await db().customer.findFirst({ where: { tenantId: s.tenantA.id, phone } });
  if (!existing) {
    await submitCustomer(page, { name: payload, phone, address: 'XSS bench', routeId: s.tenantA.routeHq! });
  }

  const customer = await waitForRow(
    () => db().customer.findFirst({ where: { tenantId: s.tenantA.id, phone } }),
    'the customer with a script payload in its name',
  );

  await gotoOk(page, mpath('/customers'), 'customers list');
  const executed = await page.evaluate(() => (window as any).__xss === 1);
  expect(executed, 'the payload must render as text, never execute').toBe(false);
  expect(customer.name).toContain('script');
});
