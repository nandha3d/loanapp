import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { loadE2eEnv } from '../microlending/support/env';

loadE2eEnv();

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3100';
const ROOT = path.resolve(__dirname, '../../..');

/**
 * Chit Funds suite.
 *
 * Serial by design, for the same reason as the micro-lending suite: the specs
 * are one continuous journey (provision → group → members → activate → auction
 * → security → payout → collection), and later files consume ids the earlier
 * ones created.
 *
 * The timeout is higher than micro-lending because the live-room specs must
 * actually wait out bidding windows and bell intervals — a room that closes
 * lazily cannot be hurried, and faking the clock would test the fake.
 */
export default defineConfig({
  testDir: __dirname,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(ROOT, 'test-report', 'chitfunds-results.json') }],
    ['html', { outputFolder: path.join(ROOT, 'test-report', 'playwright-html-chits'), open: 'never' }],
  ],
  outputDir: path.join(ROOT, 'test-results', 'chitfunds'),
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [{ name: 'chitfunds', use: { ...devices['Desktop Chrome'] } }],
});
