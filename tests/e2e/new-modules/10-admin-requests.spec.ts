import { expect, test } from '@playwright/test';
import path from 'path';

test.describe('WEB-ADMIN-REQ admin branch/module requests', () => {
  test.use({ storageState: path.join(process.cwd(), 'playwright/.auth/developer.json') });

  test('WEB-ADMIN-REQ-001 branch requests admin page loads', async ({ page }) => {
    const response = await page.goto('/admin/branch-requests', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/\/login$/);
  });

  test('WEB-ADMIN-REQ-002 module requests admin page loads', async ({ page }) => {
    const response = await page.goto('/admin/module-requests', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/\/login$/);
  });
});
