import { expect, test } from '@playwright/test';
import {
  cleanupLoanTrackUiScenario,
  seedLoanTrackUiScenario,
  type LoanTrackUiSeed,
} from '../tests/e2e/helpers/loantrackSeed';
import { loginAs, modulePath } from '../tests/e2e/helpers/loantrackSelectors';

test.describe('cross-browser login compatibility', () => {
  test.describe.configure({ mode: 'serial' });

  let seed: LoanTrackUiSeed;

  test.beforeAll(async ({}, testInfo) => {
    const project = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    seed = await seedLoanTrackUiScenario(`auth-${project}-${Date.now()}`);
  });

  test.afterAll(async () => {
    await cleanupLoanTrackUiScenario(seed.runId);
  });

  test('email login survives reload without console errors', async ({ page }) => {
    test.setTimeout(90_000);
    const browserErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));

    await page.goto('/login');
    await expect(page.getByLabel('Username / Phone / Email', { exact: true })).toBeVisible();

    await loginAs(page, {
      username: `${seed.admin.username}@example.test`,
      password: seed.password,
      callbackPath: modulePath('/dashboard'),
    });
    await expect(page).not.toHaveURL(/\/login/);

    await page.reload();
    await expect(page).not.toHaveURL(/\/login/);
    expect(browserErrors).toEqual([]);
  });
});
