import assert from 'node:assert/strict';
import { getRoleRedirectTarget, isPublicPath } from '../middleware';

assert.equal(isPublicPath('/fonts/MaterialIconsOutlined-Regular.otf'), true);
assert.equal(isPublicPath('/assets/logo.svg'), true);
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

console.log('proxy public path tests passed');
