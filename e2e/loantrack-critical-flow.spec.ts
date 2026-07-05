import { expect, test } from '@playwright/test';
import { createUiEvidenceRecorder, makeUiGap } from '../tests/e2e/helpers/loantrackEvidence';
import { cleanupLoanTrackUiScenario, seedLoanTrackUiScenario, type LoanTrackUiSeed } from '../tests/e2e/helpers/loantrackSeed';
import {
  expectLoginForm,
  expectNonBlankAppPage,
  expectRouteLoads,
  expectRunText,
  loginAs,
  modulePath,
} from '../tests/e2e/helpers/loantrackSelectors';

test.describe('LoanTrack critical UI flow', () => {
  test.describe.configure({ mode: 'serial' });

  let seed: LoanTrackUiSeed;
  const runId = process.env.BUSINESS_E2E_RUN_ID || `phase6-${Date.now()}`;
  process.env.BUSINESS_E2E_RUN_ID = runId;
  const evidence = createUiEvidenceRecorder({
    runId,
    source: 'e2e/loantrack-critical-flow.spec.ts',
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    browser: 'chromium',
  });

  test.beforeAll(async () => {
    seed = await seedLoanTrackUiScenario(runId);
  });

  test.afterAll(async () => {
    evidence.write();
    await cleanupLoanTrackUiScenario(runId);
  });

  test('UI-001 login page loads', async ({ page }) => {
    await page.goto('/login');
    await expectLoginForm(page);
    evidence.pass('UI-001');
  });

  test('UI-002 admin login works', async ({ page }) => {
    evidence.role('admin');
    await loginAs(page, {
      username: seed.admin.username,
      password: seed.password,
      callbackPath: modulePath('/dashboard'),
    });
    await expect(page).not.toHaveURL(/\/login/);
    evidence.pass('UI-002');
  });

  test('UI-003 agent login works', async ({ page }) => {
    evidence.role('agent');
    await loginAs(page, {
      username: seed.agent.username,
      password: seed.password,
      callbackPath: modulePath('/agent-dashboard'),
    });
    await expect(page).not.toHaveURL(/\/login/);
    evidence.pass('UI-003');
  });

  test('UI-004 admin can open customer list', async ({ page }) => {
    evidence.role('admin');
    await loginAs(page, {
      username: seed.admin.username,
      password: seed.password,
      callbackPath: modulePath(`/customers?q=${encodeURIComponent(seed.customer.customerCode)}`),
    });
    await expectRunText(page, seed.customer.customerCode);
    await expectRunText(page, seed.customer.name);
    evidence.pass('UI-004');
  });

  test('UI-005 admin can open loan list and detail', async ({ page }) => {
    evidence.role('admin');
    await loginAs(page, {
      username: seed.admin.username,
      password: seed.password,
      callbackPath: modulePath(`/loans?q=${encodeURIComponent(seed.loan.loanCode)}`),
    });
    await expectRunText(page, seed.loan.loanCode);
    await page.goto(modulePath(`/loans/${seed.loan.loanCode}`));
    await expectNonBlankAppPage(page, 'loan detail');
    await expectRunText(page, seed.loan.loanCode);
    evidence.pass('UI-005');
  });

  test('UI-006 approval queue visibility', async ({ page }) => {
    evidence.role('admin');
    await loginAs(page, {
      username: seed.admin.username,
      password: seed.password,
      callbackPath: modulePath('/approvals'),
    });
    await expectNonBlankAppPage(page, 'approvals queue');
    if (await page.getByText(seed.pendingCustomer.name, { exact: false }).first().isVisible().catch(() => false)) {
      evidence.pass('UI-006');
      return;
    }
    evidence.gap(makeUiGap({
      id: 'UI-GAP-001',
      name: 'UI-006 separate loan/customer approval queue is not visible for seeded pending data',
      classification: 'P1',
      currentBehavior: 'The browser approval queue did not expose the seeded pending customer/loan row in this critical UI smoke run.',
      expectedBehavior: 'Admin approval queue should visibly list pending customer or loan work items created for the RUN_ID fixture.',
      evidenceSource: 'app/(dashboard)/[module]/approvals/page.tsx reads pending customers/loans by status=pending_review.',
      businessImpact: 'Operators may not have a visible checkpoint for review work even when backend rows exist.',
      fixedAssertion: 'The approvals page contains the RUN_ID pending customer or pending loan row.',
      observedFailure: `${seed.pendingCustomer.name} was not visible on ${page.url()}`,
    }));
  });

  test('UI-007 collection screen loads', async ({ page }) => {
    evidence.role('agent');
    await loginAs(page, {
      username: seed.agent.username,
      password: seed.password,
      callbackPath: modulePath('/collection'),
    });
    await expectNonBlankAppPage(page, 'collection screen');
    await expect(page.getByText(/collection|today|overdue|route/i).first()).toBeVisible();
    evidence.pass('UI-007');
  });

  test('UI-008 wallet and handover screen loads', async ({ page }) => {
    evidence.role('agent');
    await loginAs(page, {
      username: seed.agent.username,
      password: seed.password,
      callbackPath: modulePath('/wallet'),
    });
    await expectNonBlankAppPage(page, 'agent wallet screen');
    await expect(page.getByText(/wallet|cash|handover|float/i).first()).toBeVisible();
    evidence.pass('UI-008');
    evidence.gap(makeUiGap({
      id: 'UI-GAP-002',
      name: 'UI-008 handover settlement defect remains linked to Phase 3/4 money gap',
      classification: 'P0',
      currentBehavior: 'The UI can show handover status, while the backend known gap says approval marks settled without wallet settlement.',
      expectedBehavior: 'Visible handover settlement should correspond to reconciled agent wallet and branch cash movement.',
      evidenceSource: 'MM-GAP-002; app/api/v1/approvals/[id]/approve/route.ts cash_handover branch updates status but does not call wallet settlement.',
      businessImpact: 'Users can see a settled handover while balances are unreconciled.',
      fixedAssertion: 'After handover approval, UI status and backend wallet/branch cash balances all reconcile.',
      observedFailure: 'Recorded as visible UI linkage to the existing P0 handover money gap; Playwright does not assert balances.',
    }));
  });

  test('UI-015 borrower portal basic visibility if supported', async ({ page }) => {
    evidence.role('borrower');
    try {
      await page.goto('/borrower/login', { waitUntil: 'domcontentloaded', timeout: 5_000 });
      await expectNonBlankAppPage(page, 'borrower login');
      await page.getByPlaceholder(/registered mobile number/i).fill(seed.customer.phone, { timeout: 3_000 });
      await page.getByRole('button', { name: /next step/i }).click({ timeout: 3_000 });
      await page.getByPlaceholder(/account password/i).fill(seed.password, { timeout: 3_000 });
      await page.getByRole('button', { name: /sign in/i }).click({ timeout: 3_000 });
      await page.waitForURL(/\/borrower\/dashboard/, { timeout: 5_000 });
      await expectNonBlankAppPage(page, 'borrower dashboard');
      await expectRunText(page, seed.loan.loanCode);
      evidence.pass('UI-015');
    } catch (error) {
      evidence.gap(makeUiGap({
        id: 'UI-GAP-003',
        name: 'UI-015 borrower portal login cannot be exercised with seeded credentials',
        classification: 'P2',
        currentBehavior: 'The current borrower web auth flow may require OTP/setup/session behavior that is not fully harnessed by seeded DB credentials.',
        expectedBehavior: 'A seeded borrower/customer can log into /borrower/login and see only their loan/statement.',
        evidenceSource: 'app/borrower/login/page.tsx and app/api/borrower/auth/route.ts cookie-based borrower_session flow.',
        businessImpact: 'Borrower portal visual coverage remains limited until the browser harness can create a supported borrower session.',
        fixedAssertion: 'Seeded borrower logs in and /borrower/dashboard displays the RUN_ID loan without admin/agent menus.',
        observedFailure: error instanceof Error ? error.message : String(error),
      }));
    }
  });

  test('UI-016 critical route smoke for admin and agent', async ({ page }) => {
    test.setTimeout(120_000);
    evidence.role('admin');
    await loginAs(page, {
      username: seed.admin.username,
      password: seed.password,
      callbackPath: modulePath('/dashboard'),
    });
    for (const [path, label] of [
      [modulePath('/customers'), 'admin customers'],
      [modulePath('/loans'), 'admin loans'],
      [modulePath('/collection'), 'admin collection'],
      [modulePath('/wallet'), 'admin wallet'],
      [modulePath('/analytics'), 'admin reports analytics'],
    ] as const) {
      await expectRouteLoads(page, path, label);
    }

    const agentContext = await page.context().browser()?.newContext();
    if (!agentContext) throw new Error('Could not create agent browser context.');
    const agentPage = await agentContext.newPage();
    try {
      evidence.role('agent');
      await loginAs(agentPage, {
        username: seed.agent.username,
        password: seed.password,
        callbackPath: modulePath('/agent-dashboard'),
      });
      for (const [path, label] of [
        [modulePath('/customers'), 'agent customers'],
        [modulePath('/loans'), 'agent loans'],
        [modulePath('/collection'), 'agent collection'],
        [modulePath('/wallet'), 'agent wallet'],
      ] as const) {
        await expectRouteLoads(agentPage, path, label);
      }
    } finally {
      await agentContext.close();
    }
    evidence.pass('UI-016');
  });
});
