import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { loadE2eEnv } from '../microlending/support/env';

loadE2eEnv();

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3100';
const ROOT = path.resolve(__dirname, '../../..');

/**
 * Auto Finance suite.
 *
 * Serial for the same reason as the other module suites: the specs are one
 * business journey (provision → vehicle → quote → originate → collect →
 * seize → settle), and later files consume ids the earlier ones created.
 */
export default defineConfig({
  testDir: __dirname,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(ROOT, 'test-report', 'autofinance-results.json') }],
    ['html', { outputFolder: path.join(ROOT, 'test-report', 'playwright-html-auto'), open: 'never' }],
  ],
  outputDir: path.join(ROOT, 'test-results', 'autofinance'),
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [{ name: 'autofinance', use: { ...devices['Desktop Chrome'] } }],
});
