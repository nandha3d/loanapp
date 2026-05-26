/**
 * One-time login as SUPERADMIN — saves storage state for reuse across tests.
 * Run automatically by playwright before "accounting-superadmin" project.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../playwright/.auth/superadmin.json');

setup('authenticate as superadmin', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel(/email/i).fill(process.env.SUPERADMIN_EMAIL ?? 'superadmin@example.com');
  await page.getByLabel(/password/i).fill(process.env.SUPERADMIN_PASS ?? 'Secret123!');
  await page.getByRole('button', { name: /sign in|login/i }).click();

  // Wait until redirected away from /login
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15_000 });

  await page.context().storageState({ path: authFile });
});
