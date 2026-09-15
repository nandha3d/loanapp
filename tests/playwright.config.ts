import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the Accounting E2E test suite.
 *
 * Install playwright first:
 *   npm install -D @playwright/test
 *   npx playwright install chromium
 *
 * Run:
 *   npx playwright test tests/e2e/accounting
 *
 * Env vars (override via .env.test or shell export):
 *   BASE_URL           http://localhost:3000
 *   TEST_MODULE        demo          ← tenant module slug in the URL
 *   SUPERADMIN_EMAIL   superadmin@example.com
 *   SUPERADMIN_PASS    Secret123!
 *   ADMIN_EMAIL        admin@example.com
 *   ADMIN_PASS         Secret123!
 */

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,          // accounting tests mutate DB state — run serially
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 8_000 },

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },

  projects: [
    /* ── Storage-state setup (login once, reuse cookie) ────────── */
    {
      name: 'setup-superadmin',
      testMatch: '**/accounting.setup.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'setup-admin',
      testMatch: '**/accounting.admin.setup.ts',
      use: { ...devices['Desktop Chrome'] },
    },

    /* ── Main test project (depends on setup) ────────────────── */
    {
      name: 'accounting-superadmin',
      testMatch: '**/accounting/**/*.spec.ts',
      dependencies: ['setup-superadmin'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/superadmin.json',
      },
    },
    {
      name: 'accounting-admin',
      testMatch: '**/accounting/role-admin.spec.ts',
      dependencies: ['setup-admin'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
    },
  ],
});
