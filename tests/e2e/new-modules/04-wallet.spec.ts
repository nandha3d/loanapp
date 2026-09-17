import { expect, test } from '@playwright/test';
import path from 'path';
import { expectAppShell, expectOneOfText, gotoModule, moduleRoute } from './helpers';

test.describe('WEB-WALLET cash float module', () => {
  test('WEB-WALLET-001 wallet page loads for privileged default role', async ({ page }) => {
    const response = await gotoModule(page, '/wallet');
    expect(response?.status()).toBeLessThan(500);
    await expectAppShell(page);
    await expectOneOfText(page, [/Wallet/i, /Cash/i, /Float/i, /Agent/i]);
  });

  test('WEB-WALLET-002 agent role is redirected away from wallet', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(process.cwd(), 'playwright/.auth/agent.json'),
    });
    const page = await context.newPage();
    await page.goto(moduleRoute('/wallet'), { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/collection|\/dashboard|\/agent-dashboard|\/login/, { timeout: 10_000 });
    await context.close();
  });
});
