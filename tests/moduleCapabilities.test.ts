import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getSettingsTabsForAppType,
  isLendingAppType,
  normalizeSettingsTab,
} from '../lib/moduleCapabilities';

assert.equal(isLendingAppType('chitfunds'), false);
assert.equal(isLendingAppType('autofinance'), true);

const chitTabs = getSettingsTabsForAppType('chitfunds', {
  whatsappSmsEnabled: true,
  bureauEnabled: true,
  npaEnabled: true,
});

for (const hiddenTab of ['penalty', 'packages', 'bureau', 'npa']) {
  assert.equal(chitTabs.includes(hiddenTab), false, `${hiddenTab} must be hidden for chitfunds`);
}
assert.equal(chitTabs.includes('routes'), true);
assert.equal(chitTabs.includes('notifications'), true);
assert.equal(normalizeSettingsTab('chitfunds', 'npa', { npaEnabled: true }), 'routes');
assert.equal(normalizeSettingsTab('microlending', 'npa', { npaEnabled: true }), 'npa');

const settingsSource = readFileSync(
  join(process.cwd(), 'app/(dashboard)/[module]/settings/SettingsClient.tsx'),
  'utf8',
);
assert.match(settingsSource, /normalizeSettingsTab/, 'Settings must reject hidden tab query parameters');
assert.match(settingsSource, /isLendingModule && \(/, 'lending-only settings content must be conditionally rendered');

const customerFormSource = readFileSync(
  join(process.cwd(), 'app/(dashboard)/[module]/customers/new/CustomerForm.tsx'),
  'utf8',
);
const newCustomerPageSource = readFileSync(
  join(process.cwd(), 'app/(dashboard)/[module]/customers/new/page.tsx'),
  'utf8',
);
assert.match(customerFormSource, /appType: string/, 'customer form must receive the active app type');
assert.match(customerFormSource, /const isChit = appType === 'chitfunds'/, 'customer form must identify chit tenants');
assert.equal(
  (customerFormSource.match(/!isChit && \(/g) ?? []).length >= 2,
  true,
  'business underwriting and generic loan guarantors must both be hidden for chit tenants',
);
assert.match(newCustomerPageSource, /appType=\{appType\}/, 'customer page must pass its app type to the form');

console.log('moduleCapabilities tests passed');
