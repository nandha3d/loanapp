import { expect, test } from '@playwright/test';
import path from 'path';
import { moduleRoute } from './helpers';

test.describe('WEB-RBAC-NEG new module negative role checks', () => {
  test('SEC-NEG-WEB-001 unauthenticated private routes redirect to login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    for (const route of ['/wallet', '/reports', '/settings', '/vehicles']) {
      await page.goto(moduleRoute(route));
      await expect(page).toHaveURL(/\/login|\/collection|\/dashboard/, { timeout: 10_000 });
    }
    await context.close();
  });

  test('SEC-NEG-WEB-002 agent cannot access developer admin pages', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(process.cwd(), 'playwright/.auth/agent.json'),
    });
    const page = await context.newPage();
    for (const route of ['/admin/users', '/admin/branches', '/admin/billing/pricing']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/login|\/dashboard|\/agent-dashboard|\/collection|\/portal/, { timeout: 10_000 });
    }
    await context.close();
  });

  test('SEC-NEG-WEB-003 agent direct new loan route stays protected', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(process.cwd(), 'playwright/.auth/agent.json'),
    });
    const page = await context.newPage();
    await page.goto(moduleRoute('/loans/new'), { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/collection|\/dashboard|\/agent-dashboard|\/login/, { timeout: 10_000 });
    await context.close();
  });
});
