import assert from 'node:assert/strict';
import { getPublicOrigin, getRoleRedirectTarget, isPublicPath } from '../proxy';
import { normalizeLocalCallbackUrl } from '../lib/auth/callback-url';

assert.equal(isPublicPath('/fonts/MaterialIconsOutlined-Regular.otf'), true);
assert.equal(isPublicPath('/assets/logo.svg'), true);
assert.equal(isPublicPath('/dashboard'), false);

assert.equal(getRoleRedirectTarget('/loans', 'agent'), null);
assert.equal(getRoleRedirectTarget('/customers/new', 'agent'), null);
assert.equal(getRoleRedirectTarget('/customers/customer-1/edit', 'agent'), '/customers');
assert.equal(getRoleRedirectTarget('/reports', 'agent'), '/portal');
// ML-067 / §7.2 — the portal is the module switcher; an agent is sent back to
// their own workspace ('/' resolves their appType in app/page.tsx).
assert.equal(getRoleRedirectTarget('/portal', 'agent'), '/');
// ML-163 — /customers/new?edit=<id> IS the edit form; an agent may create a
// customer but never edit one.
assert.equal(getRoleRedirectTarget('/customers/new', 'agent', true), '/customers');
assert.equal(getRoleRedirectTarget('/microlending/customers/new', 'agent', true), '/microlending/customers');
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
  normalizeLocalCallbackUrl('https://app.animazon.in/portal'),
  '/portal',
);
assert.equal(
  normalizeLocalCallbackUrl('https://loan.samuraibuiness.in/portal?x=1'),
  '/portal?x=1',
);

console.log('proxy public path tests passed');
