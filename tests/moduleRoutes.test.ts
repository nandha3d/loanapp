import assert from 'node:assert/strict';
import { isRouteEnabledForModules, moduleForRoute } from '../types/modules';

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

console.log('module route tests passed');
