import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { loadE2eEnv } from './support/env';

loadE2eEnv();

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3100';
const ROOT = path.resolve(__dirname, '../../..');

/**
 * Micro-lending journey suite.
 *
 * Serial by design: the specs are one continuous business journey (register →
 * verify → branches → staff → capital → customers → loans → collection), and
 * later files consume ids the earlier ones created. Parallel workers would race
 * on the same tenant.
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
    ['json', { outputFile: path.join(ROOT, 'test-report', 'microlending-results.json') }],
    ['html', { outputFolder: path.join(ROOT, 'test-report', 'playwright-html'), open: 'never' }],
  ],
  outputDir: path.join(ROOT, 'test-results', 'microlending'),
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [{ name: 'microlending', use: { ...devices['Desktop Chrome'] } }],
});
