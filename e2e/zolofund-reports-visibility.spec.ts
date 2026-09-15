import { expect, test } from '@playwright/test';
import { createUiEvidenceRecorder } from '../tests/e2e/helpers/zolofundEvidence';
import { cleanupZoloFundUiScenario, seedZoloFundUiScenario, type ZoloFundUiSeed } from '../tests/e2e/helpers/zolofundSeed';
import { expectNonBlankAppPage, loginAs, modulePath } from '../tests/e2e/helpers/zolofundSelectors';

test.describe('ZoloFund reports visibility', () => {
  test.describe.configure({ mode: 'serial' });

  let seed: ZoloFundUiSeed;
  const runId = process.env.BUSINESS_E2E_RUN_ID || `phase6-${Date.now()}`;
  process.env.BUSINESS_E2E_RUN_ID = runId;
  const evidence = createUiEvidenceRecorder({
    runId,
    source: 'e2e/zolofund-reports-visibility.spec.ts',
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    browser: 'chromium',
  });

  test.beforeAll(async () => {
    seed = await seedZoloFundUiScenario(runId);
  });

  test.afterAll(async () => {
    evidence.write();
    await cleanupZoloFundUiScenario(runId);
  });

  test('UI-009 admin can open reports and a high-value report page', async ({ page }) => {
    evidence.role('admin');
    await loginAs(page, {
      username: seed.admin.username,
      password: seed.password,
      callbackPath: modulePath('/analytics'),
    });
    await expectNonBlankAppPage(page, 'reports analytics');
    await expect(page.getByText(/reports|analytics|collection operations/i).first()).toBeVisible();

    await page.goto(modulePath('/analytics?report=daily-collection'));
    await expectNonBlankAppPage(page, 'daily collection report');
    await expect(page.getByText(/daily collection/i).first()).toBeVisible();
    evidence.pass('UI-009');
  });

  test('UI-010 export controls are visible for admin and restricted from agent reports UI', async ({ page }) => {
    evidence.role('admin');
    await loginAs(page, {
      username: seed.admin.username,
      password: seed.password,
      callbackPath: modulePath('/analytics?report=daily-collection'),
    });
    await expect(page.getByRole('link', { name: /export csv|collections csv|loan register csv/i }).or(
      page.getByRole('button', { name: /export csv|export excel|export pdf/i }),
    ).first()).toBeVisible();

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
      await agentPage.goto(modulePath('/analytics?report=daily-collection'));
      await agentPage.waitForLoadState('domcontentloaded');
      expect(agentPage.url()).not.toMatch(/\/analytics/);
      await expect(agentPage.getByRole('link', { name: /export csv|export excel|export pdf|collections csv|loan register csv/i })).toHaveCount(0);
    } finally {
      await agentContext.close();
    }
    evidence.pass('UI-010');
  });
});
