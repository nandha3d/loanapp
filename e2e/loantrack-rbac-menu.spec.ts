import { expect, test } from '@playwright/test';
import { createUiEvidenceRecorder, makeUiGap } from '../tests/e2e/helpers/loantrackEvidence';
import { cleanupLoanTrackUiScenario, seedLoanTrackUiScenario, type LoanTrackUiSeed } from '../tests/e2e/helpers/loantrackSeed';
import { loginAs, menuLink, modulePath } from '../tests/e2e/helpers/loantrackSelectors';

test.describe('LoanTrack RBAC and menu visibility', () => {
  test.describe.configure({ mode: 'serial' });

  let seed: LoanTrackUiSeed;
  const runId = process.env.BUSINESS_E2E_RUN_ID || `phase6-${Date.now()}`;
  process.env.BUSINESS_E2E_RUN_ID = runId;
  const evidence = createUiEvidenceRecorder({
    runId,
    source: 'e2e/loantrack-rbac-menu.spec.ts',
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

  test('UI-011 admin sees admin menus', async ({ page }) => {
    evidence.role('admin');
    await loginAs(page, {
      username: seed.admin.username,
      password: seed.password,
      callbackPath: modulePath('/dashboard'),
    });
    await expect(menuLink(page, [/customers/i])).toBeVisible();
    await expect(menuLink(page, [/loans/i])).toBeVisible();
    await expect(menuLink(page, [/settings/i])).toBeVisible();
    await expect(menuLink(page, [/reports|analytics/i])).toBeVisible();
    await expect(menuLink(page, [/approvals/i])).toBeVisible();
    evidence.pass('UI-011');
  });

  test('UI-012 agent does not see admin-only menus', async ({ page }) => {
    evidence.role('agent');
    await loginAs(page, {
      username: seed.agent.username,
      password: seed.password,
      callbackPath: modulePath('/agent-dashboard'),
    });
    await expect(menuLink(page, [/settings/i])).toHaveCount(0);
    await expect(menuLink(page, [/reports|analytics/i])).toHaveCount(0);
    await expect(menuLink(page, [/dashboard/i]).filter({ hasNotText: /agent/i })).toHaveCount(0);

    for (const blockedPath of [modulePath('/settings'), modulePath('/analytics'), modulePath('/dashboard')]) {
      await page.goto(blockedPath);
      await page.waitForLoadState('domcontentloaded');
      expect(page.url(), `agent should be redirected away from ${blockedPath}`).not.toMatch(new RegExp(`${blockedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    }
    evidence.pass('UI-012');
  });

  test('UI-013 manager branch-scoped UI known gap when manager role is absent', async () => {
    evidence.gap(makeUiGap({
      id: 'UI-GAP-004',
      name: 'UI-013 manager branch-scoped UI role is not discoverable',
      classification: 'P2',
      currentBehavior: 'Current web RBAC uses admin/superadmin/developer/agent patterns; a distinct manager role is not discoverable in sidebar or middleware role checks.',
      expectedBehavior: 'If manager is a supported role, a seeded manager can log in and see only branch-scoped customer/loan/collection data.',
      evidenceSource: 'middleware.ts getRoleRedirectTarget and components/layout/Sidebar.tsx role gates do not define a first-class manager role.',
      businessImpact: 'Manager-specific visual RBAC cannot be proven until the role contract is explicit.',
      fixedAssertion: 'Seeded manager logs in, branch menus render, and cross-branch rows are not visible.',
      observedFailure: 'Recorded as a known UI gap; no manager role fixture is safe to invent.',
    }));
  });

  test('UI-014 disabled-module menu gating known gap when API boundary is absent', async () => {
    evidence.gap(makeUiGap({
      id: 'UI-GAP-005',
      name: 'UI-014 disabled module menu gating is not consistently enforceable from UI',
      classification: 'optional',
      currentBehavior: 'Module menu visibility is branch/subscription driven, while Phase 5 tracks inconsistent backend disabled-module enforcement.',
      expectedBehavior: 'Disabled modules should hide menus and block direct route access consistently.',
      evidenceSource: 'components/layout/Sidebar.tsx filters by enabledModules/appTypes; MOD-GAP-001 tracks backend disabled-module inconsistency.',
      businessImpact: 'Optional-module UI can look hidden while direct/backend access policy remains inconsistent.',
      fixedAssertion: 'Disabled module menu is hidden and direct route returns redirect/blocked page for the same RUN_ID fixture.',
      observedFailure: 'Recorded as an optional known UI gap linked to MOD-GAP-001.',
    }));
  });
});
