import { expect, test } from '@playwright/test';
import { expectAppShell, expectOneOfText, gotoModule } from './helpers';

test.describe('WEB-SETTINGS payment and settings module', () => {
  test('WEB-SETTINGS-001 settings page loads', async ({ page }) => {
    const response = await gotoModule(page, '/settings');
    expect(response?.status()).toBeLessThan(500);
    await expectAppShell(page);
    await expectOneOfText(page, [/Settings/i, /Routes/i, /Package/i, /System/i]);
  });

  test('WEB-PAYMENT-001 payment gateway settings page loads', async ({ page }) => {
    const response = await gotoModule(page, '/settings/payment-gateway');
    expect(response?.status()).toBeLessThan(500);
    await expectAppShell(page);
    await expectOneOfText(page, [/Payment/i, /Gateway/i, /Razorpay/i, /UPI/i]);
  });
});
