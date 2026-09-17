import { expect, test } from '@playwright/test';
import { expectAppShell, expectOneOfText, gotoModule } from './helpers';

test.describe('WEB-NOTIF notifications module', () => {
  test('WEB-NOTIF-001 notification list loads', async ({ page }) => {
    const response = await gotoModule(page, '/notifications');
    expect(response?.status()).toBeLessThan(500);
    await expectAppShell(page);
    await expectOneOfText(page, [/Notification/i, /No notifications/i, /Unread/i]);
  });

  test('WEB-NOTIF-002 notification log route loads without server error', async ({ page }) => {
    const response = await gotoModule(page, '/notifications/log');
    expect(response?.status()).toBeLessThan(500);
    await expectAppShell(page);
  });
});
