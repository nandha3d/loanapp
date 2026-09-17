import { expect, test, type Page } from '@playwright/test';
import { expectNonBlankAppPage, loginAs } from '../tests/e2e/helpers/zolofundSelectors';

async function sessionUser(page: Page) {
  const response = await page.request.get('/api/auth/session');
  expect(response.status(), 'session endpoint should remain healthy').toBe(200);
  const body = await response.json();
  return body?.user ?? null;
}

test.describe('ZoloFund agent portal module selection', () => {
  test.describe.configure({ mode: 'serial' });

  const agentUsername = process.env.AGENT_EMAIL ?? 'karthik';
  const agentPassword = process.env.AGENT_PASS ?? 'agent123';

  test('agent can enter Micro Lending from the portal without losing the session', async ({ page }) => {
    test.setTimeout(120_000);

    await loginAs(page, {
      username: agentUsername,
      password: agentPassword,
      callbackPath: '/portal',
    });

    await expect(page).toHaveURL(/\/portal$/);
    const beforeUser = await sessionUser(page);
    expect(beforeUser?.role).toBe('agent');
    expect(beforeUser?.username).toBe(agentUsername);

    await page.getByRole('button', { name: /micro lending/i }).click();
    await page.waitForURL((url) => url.pathname.startsWith('/microlending/'), { timeout: 60_000 });
    await expect(page, 'agent should not be bounced back to login after selecting Micro Lending').not.toHaveURL(/\/login/);
    await expectNonBlankAppPage(page, 'agent Micro Lending module shell');
    await expect(page.getByText(/field agent|today's collection|my customers/i).first()).toBeVisible();

    const afterUser = await sessionUser(page);
    expect(afterUser?.role).toBe('agent');
    expect(afterUser?.username).toBe(agentUsername);

    const visibleText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim().slice(0, 240);
    console.log('[agent-portal-visual]', JSON.stringify({
      finalUrl: page.url(),
      beforeSession: { role: beforeUser?.role, username: beforeUser?.username },
      afterSession: { role: afterUser?.role, username: afterUser?.username },
      visibleText,
    }));
  });
});
