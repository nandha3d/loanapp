import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const map = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'docs/mobile-parity/role-ui-map.json'), 'utf8'),
) as {
  roles: Record<string, { web: { landing: string } }>;
};

const storageFor = (role: string) => path.join(process.cwd(), 'playwright/.auth', `${role}.json`);

for (const role of Object.keys(map.roles)) {
  test.describe(`role smoke: ${role}`, () => {
    test.use({ storageState: storageFor(role) });

    test(`opens web landing route for ${role}`, async ({ page }) => {
      await page.goto(map.roles[role].web.landing);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('body')).not.toContainText(/sign in|login/i);
    });
  });
}
