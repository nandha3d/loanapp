import { expect, type Page } from '@playwright/test';
import { db, waitForRow } from './db';
import { waitForHydration } from './ui';

/**
 * Create a staff account through the Master Users modal.
 *
 * Role and branch are dependent selects — choosing a role re-renders the module
 * and branch controls — so each choice is followed by a settle before the next
 * one is made. On failure the page text is surfaced, because the action reports
 * refusals inline and a bare "row never appeared" says nothing useful.
 */
export async function createStaffUser(
  page: Page,
  input: { name: string; username: string; phone: string; password: string; role: 'admin' | 'agent'; branchId: string },
) {
  // Master Users reports refusals through window.alert, which Playwright
  // dismisses silently by default — capture the text or the reason is lost.
  const alerts: string[] = [];
  const onDialog = async (d: import('@playwright/test').Dialog) => {
    alerts.push(d.message());
    await d.dismiss().catch(() => {});
  };
  page.on('dialog', onDialog);

  await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
  await waitForHydration(page, 'table');

  await page.getByRole('button', { name: /new user/i }).click();
  const username = page.locator('input[name="username"]');
  await expect(username, 'the new-user modal should open').toBeVisible({ timeout: 15_000 });

  await page.locator('input[name="name"]').fill(input.name);
  await username.fill(input.username);
  await page.locator('input[name="phone"]').fill(input.phone);
  await page.locator('input[name="password"]').fill(input.password);

  await page.locator('select[name="role"]').selectOption(input.role);
  await page.waitForTimeout(400);
  await page.locator('select[name="branchId"]').selectOption(input.branchId);
  await page.waitForTimeout(300);

  // The form debounces a username/phone availability probe and refuses to save
  // while it is in flight, so let it land before pressing Save.
  await page
    .waitForResponse((r) => r.url().includes('/api/users/availability'), { timeout: 8_000 })
    .catch(() => null);
  await page.waitForTimeout(600);

  const save = page.getByRole('button', { name: /save user/i });
  let closed = false;
  for (let attempt = 0; attempt < 3 && !closed; attempt++) {
    await save.click();
    closed = await username
      .waitFor({ state: 'detached', timeout: 25_000 })
      .then(() => true)
      .catch(() => false);
    // "still checking" is a race with the probe, not a refusal — retry once it lands.
    if (!closed && !/checking/i.test(alerts.at(-1) ?? '')) break;
    if (!closed) await page.waitForTimeout(1_500);
  }

  page.off('dialog', onDialog);

  if (!closed) {
    const inline = await page
      .locator('[role="alert"], .form-error, .error-text')
      .first()
      .innerText()
      .catch(() => '');
    const reason = [...alerts, inline].filter(Boolean).join(' | ').replace(/\s+/g, ' ').slice(0, 500);
    return { saved: false, reason: reason || 'the modal stayed open with no message' };
  }
  return { saved: true, reason: alerts.join(' | ') };
}

/**
 * Create the staff account through the UI, or reuse the one a previous partial
 * run of this same tenant already created.
 *
 * A full suite run always provisions a fresh tenant, so the UI path is the one
 * that actually executes when results are reported. The reuse branch only keeps
 * a re-run of a single spec file from failing on its own leftovers.
 */
export async function ensureStaffUser(
  page: Page,
  tenantId: string,
  input: { name: string; username: string; phone: string; password: string; role: 'admin' | 'agent'; branchId: string },
) {
  const existing = await db().user.findFirst({ where: { tenantId, username: input.username } });
  if (existing) return existing;

  const outcome = await createStaffUser(page, input);
  expect(outcome.saved, `the user save was refused: ${outcome.reason}`).toBe(true);

  return waitForRow(
    () => db().user.findFirst({ where: { tenantId, username: input.username } }),
    `the ${input.role} account ${input.username}`,
  );
}
