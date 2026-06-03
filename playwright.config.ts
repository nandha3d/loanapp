import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright config for the LoanTrack web app E2E suite.
 *
 * RUN:
 *   1. Seed a DB with the standard test users + sample data:
 *        npm run db:seed
 *      (the fresh-wipe state only has `developer`; the suite needs
 *       superadmin/super123, admin/admin123, agent karthik/agent123.)
 *   2. Start the app:  npm run build && npm run start   (or `npm run dev`)
 *   3. Run:            npx playwright test
 *
 * ENV overrides: E2E_BASE_URL, TEST_MODULE, *_EMAIL / *_PASS.
 */
export const STORAGE = {
  superadmin: path.join(__dirname, 'playwright/.auth/superadmin.json'),
  admin: path.join(__dirname, 'playwright/.auth/admin.json'),
  agent: path.join(__dirname, 'playwright/.auth/agent.json'),
};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 8_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // 1. Auth — logs in each role once, saves storage state.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    // 2. Main suite — runs as superadmin by default. Specs needing another
    //    role call `test.use({ storageState: STORAGE.admin | .agent })`.
    {
      name: 'e2e',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: STORAGE.superadmin },
    },
  ],

  // Uncomment to let Playwright start the server itself:
  // webServer: {
  //   command: 'npm run start',
  //   url: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
});
