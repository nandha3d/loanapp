import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

export const STORAGE = {
  developer: path.join(process.cwd(), 'playwright/.auth/developer.json'),
  superadmin: path.join(process.cwd(), 'playwright/.auth/superadmin.json'),
  admin: path.join(process.cwd(), 'playwright/.auth/admin.json'),
  agent: path.join(process.cwd(), 'playwright/.auth/agent.json'),
};

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const isLoanTrackCriticalUi = process.env.LOANTRACK_E2E_UI === '1';
const baseUrlPort = new URL(BASE_URL).port || '3000';
const criticalUiServerEnv = {
  ...process.env,
  DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '',
  AUTH_SECRET: process.env.AUTH_SECRET || 'business-e2e-secret-business-e2e-secret',
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'business-e2e-secret-business-e2e-secret',
  MOBILE_JWT_SECRET: process.env.MOBILE_JWT_SECRET || process.env.AUTH_SECRET || 'business-e2e-secret-business-e2e-secret',
  PII_ENCRYPTION_KEY: process.env.PII_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef',
  AUTH_URL: process.env.AUTH_URL || BASE_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || BASE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || BASE_URL,
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost',
};

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: !isLoanTrackCriticalUi,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI || isLoanTrackCriticalUi ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: BASE_URL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: isLoanTrackCriticalUi ? [
    {
      name: 'loantrack-critical-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ] : [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    /* Webkit often times out on Windows local dev environments */
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: isLoanTrackCriticalUi ? {
    command: `npm run dev -- -p ${baseUrlPort}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: process.env.LOANTRACK_E2E_REUSE_SERVER === '1',
    timeout: 180_000,
    env: criticalUiServerEnv,
  } : undefined,
});
