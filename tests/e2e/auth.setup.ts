import { test as setup } from '@playwright/test';
import path from 'path';

type Role = 'developer' | 'superadmin' | 'admin' | 'agent';

setup.describe.configure({ mode: 'serial' });

const roles: Record<Role, { username: string; password: string }> = {
  developer: {
    username: process.env.DEVELOPER_EMAIL ?? 'developer',
    password: process.env.DEVELOPER_PASS ?? 'dev123',
  },
  superadmin: {
    username: process.env.SUPERADMIN_EMAIL ?? 'superadmin',
    password: process.env.SUPERADMIN_PASS ?? 'super123',
  },
  admin: {
    username: process.env.ADMIN_EMAIL ?? 'admin',
    password: process.env.ADMIN_PASS ?? 'admin123',
  },
  agent: {
    username: process.env.AGENT_EMAIL ?? 'karthik',
    password: process.env.AGENT_PASS ?? 'agent123',
  },
};

for (const [role, credentials] of Object.entries(roles) as Array<[Role, { username: string; password: string }]>) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/username|phone/i).fill(credentials.username);
    await page.getByLabel(/password/i).fill(credentials.password);
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 });
    await page.context().storageState({
      path: path.join(__dirname, '../../playwright/.auth', `${role}.json`),
    });
  });
}
