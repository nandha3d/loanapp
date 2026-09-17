import { expect, test } from '@playwright/test';
import path from 'path';
import { expectAppShell, expectOneOfText, gotoModule, moduleRoute } from './helpers';

test.describe('WEB-APPROVAL-KYC approvals and KYC review', () => {
  test('WEB-APPROVAL-001 approvals page loads', async ({ page }) => {
    const response = await gotoModule(page, '/approvals');
    expect(response?.status()).toBeLessThan(500);
    await expectAppShell(page);
    await expectOneOfText(page, [/Approval/i, /Pending/i, /Request/i]);
  });

  test('WEB-KYC-001 KYC review page loads for privileged role', async ({ page }) => {
    const response = await gotoModule(page, '/kyc-review');
    expect(response?.status()).toBeLessThan(500);
    await expectAppShell(page);
    await expectOneOfText(page, [/KYC/i, /Review/i, /Verification/i]);
  });

  test('WEB-KYC-002 agent is redirected away from KYC review', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(process.cwd(), 'playwright/.auth/agent.json'),
    });
    const page = await context.newPage();
    await page.goto(moduleRoute('/kyc-review'), { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/dashboard|\/agent-dashboard|\/collection|\/login/, { timeout: 10_000 });
    await context.close();
  });
});
