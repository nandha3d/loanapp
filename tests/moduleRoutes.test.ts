import assert from 'node:assert/strict';
import {
  isRouteEnabledForModules,
  mergeModuleLists,
  moduleForRoute,
  modulePath,
  parseModulePath,
  prefixDashboardHref,
} from '../types/modules';

assert.equal(modulePath('microlending', '/dashboard'), '/microlending/dashboard');
assert.equal(modulePath('chitfunds', '/dashboard'), '/chitfunds/dashboard');
assert.equal(modulePath('autofinance', 'vehicles'), '/autofinance/vehicles');
assert.deepEqual(parseModulePath('/autofinance/vehicles/vehicle-1'), {
  module: 'autofinance',
  page: '/vehicles/vehicle-1',
});
assert.deepEqual(parseModulePath('/portal'), { module: null, page: '/portal' });
assert.equal(prefixDashboardHref('/loans/LN0001', 'microlending'), '/microlending/loans/LN0001');
assert.equal(prefixDashboardHref('/api/export/loans', 'microlending'), '/api/export/loans');

assert.equal(moduleForRoute('/vehicles'), 'autofinance');
assert.equal(moduleForRoute('/vehicles/new'), 'autofinance');
assert.equal(moduleForRoute('/chits'), 'chitfunds');
assert.equal(moduleForRoute('/loans'), 'microlending');
assert.equal(moduleForRoute('/dashboard'), null);

assert.equal(isRouteEnabledForModules('/vehicles', ['microlending']), false);
assert.equal(isRouteEnabledForModules('/vehicles/new', ['autofinance']), true);
assert.equal(isRouteEnabledForModules('/chits/123', ['chitfunds']), true);
assert.equal(isRouteEnabledForModules('/loans/new', ['microlending']), true);
assert.equal(isRouteEnabledForModules('/dashboard', []), true);
assert.equal(isRouteEnabledForModules('/microlending/loans/new', ['microlending']), true);
assert.equal(isRouteEnabledForModules('/microlending/vehicles', ['microlending']), false);
assert.equal(isRouteEnabledForModules('/autofinance/vehicles/new', ['autofinance']), true);
assert.equal(isRouteEnabledForModules('/chitfunds/loans', ['chitfunds']), false);
assert.equal(isRouteEnabledForModules('/chitfunds/wallet', ['chitfunds']), false);
assert.equal(isRouteEnabledForModules('/microlending/wallet', ['microlending']), true);
assert.equal(isRouteEnabledForModules('/chitfunds/customers', ['microlending']), false);
assert.equal(isRouteEnabledForModules('/microlending/settings', ['microlending']), true);
assert.deepEqual(mergeModuleLists('["microlending"]', '["chitfunds","microlending"]'), ['microlending', 'chitfunds']);

console.log('module route tests passed');
