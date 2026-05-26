/**
 * One-time login as ADMIN — saves storage state for role-restricted tests.
 */
import { test as setup } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../playwright/.auth/admin.json');

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel(/email/i).fill(process.env.ADMIN_EMAIL ?? 'admin@example.com');
  await page.getByLabel(/password/i).fill(process.env.ADMIN_PASS ?? 'Secret123!');
  await page.getByRole('button', { name: /sign in|login/i }).click();

  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15_000 });
  await page.context().storageState({ path: authFile });
});
