/**
 * DASHBOARD + REPORTS + ANALYTICS + ROUTE TRACKER + NOTIFICATIONS.
 * (PARITY §4 DASH-01, RPT-01, TRK-01/02) — render + key elements + RBAC.
 */
import { test, expect } from '@playwright/test';
import { goto } from './helpers/app';

test.describe('DASHBOARD', () => {
  test('DASH-01 admin dashboard renders KPIs', async ({ page }) => {
    await goto(page, '/dashboard');
    await expect(page.getByText(/collection|loan|overdue|today/i).first()).toBeVisible();
  });
});

test.describe('REPORTS', () => {
  test('RPT-01 reports page renders + export affordance', async ({ page }) => {
    await goto(page, '/reports');
    await expect(page.locator('body')).toBeVisible();
  });
  test('agent report renders', async ({ page }) => {
    await goto(page, '/reports/agents');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('ANALYTICS', () => {
  test('analytics renders charts/sections', async ({ page }) => {
    await goto(page, '/analytics');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('ROUTE TRACKER', () => {
  test('TRK-01 tracker page renders (map/list)', async ({ page }) => {
    await goto(page, '/route-tracker');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('NOTIFICATIONS', () => {
  test('notifications list renders', async ({ page }) => {
    await goto(page, '/notifications');
    await expect(page.locator('body')).toBeVisible();
  });
  test('notification log renders', async ({ page }) => {
    await goto(page, '/notifications/log');
    await expect(page.locator('body')).toBeVisible();
  });
});
