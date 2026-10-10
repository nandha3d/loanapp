import assert from 'node:assert/strict';
import { getPublicOrigin, getRoleRedirectTarget, isPublicPath } from '../proxy';
import { normalizeLocalCallbackUrl } from '../lib/auth/callback-url';

assert.equal(isPublicPath('/fonts/MaterialIconsOutlined-Regular.otf'), true);
assert.equal(isPublicPath('/assets/logo.svg'), true);
assert.equal(isPublicPath('/assets/logo-horizontal-dark.png'), true);
assert.equal(isPublicPath('/assets/logo-horizontal-light.png'), true);
assert.equal(isPublicPath('/assets/logo-square-dark.png'), true);
assert.equal(isPublicPath('/assets/logo-square-light.png'), true);
assert.equal(isPublicPath('/logo.png'), true);
assert.equal(isPublicPath('/zolofunds'), true);
assert.equal(isPublicPath('/privacy'), true);
assert.equal(isPublicPath('/terms'), true);
assert.equal(isPublicPath('/refund'), true);
assert.equal(isPublicPath('/security'), true);
assert.equal(isPublicPath('/delete-account'), true);
assert.equal(isPublicPath('/dashboard'), false);

assert.equal(getRoleRedirectTarget('/loans', 'agent'), null);
assert.equal(getRoleRedirectTarget('/customers/new', 'agent'), null);
assert.equal(getRoleRedirectTarget('/customers/customer-1/edit', 'agent'), '/customers');
assert.equal(getRoleRedirectTarget('/reports', 'agent'), '/portal');
assert.equal(getRoleRedirectTarget('/portal', 'agent'), null);
assert.equal(getRoleRedirectTarget('/dashboard', 'developer'), '/admin');
assert.equal(getRoleRedirectTarget('/microlending/dashboard', 'developer'), null);
assert.equal(getRoleRedirectTarget('/microlending/reports', 'agent'), '/microlending/collection');
assert.equal(getRoleRedirectTarget('/autofinance/customers/customer-1/edit', 'agent'), '/autofinance/customers');
assert.equal(getRoleRedirectTarget('/admin', 'admin'), '/portal');
assert.equal(getRoleRedirectTarget('/portal', 'superadmin'), null);

const samuraiRequest = new Request('http://localhost:3000/portal', {
  headers: {
    host: 'localhost:3000',
    'x-forwarded-host': 'loan.samuraibuiness.in',
    'x-forwarded-proto': 'https',
  },
}) as any;
assert.equal(getPublicOrigin(samuraiRequest), 'https://loan.samuraibuiness.in');
assert.equal(
  normalizeLocalCallbackUrl('https://app.zolofunds.com/portal'),
  '/portal',
);
assert.equal(
  normalizeLocalCallbackUrl('https://zolofunds.com/portal'),
  '/portal',
);
assert.equal(
  normalizeLocalCallbackUrl('https://app.animazon.in/portal'),
  '/portal',
);
assert.equal(
  normalizeLocalCallbackUrl('https://loan.samuraibuiness.in/portal?x=1'),
  '/portal?x=1',
);

async function runAsyncTests() {
  const { NextRequest } = await import('next/server');
  const { proxy } = await import('../proxy');

  const zoloLoginReq = new NextRequest('http://zolofunds.com/login');
  const zoloLoginRes = await proxy(zoloLoginReq);
  assert.equal(zoloLoginRes.status, 307);
  assert.equal(zoloLoginRes.headers.get('location'), 'https://app.zolofunds.com/login');

  const zoloRegisterReq = new NextRequest('http://zolofunds.com/register');
  const zoloRegisterRes = await proxy(zoloRegisterReq);
  assert.equal(zoloRegisterRes.status, 307);
  assert.equal(zoloRegisterRes.headers.get('location'), 'https://app.zolofunds.com/register');

  console.log('proxy public path tests passed');
}

runAsyncTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
