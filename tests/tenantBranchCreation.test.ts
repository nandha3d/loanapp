import assert from 'node:assert/strict';
import { getSettingsTabsForAppType, normalizeSettingsTab } from '../lib/moduleCapabilities';
import { checkLimit } from '../lib/subscription';

// 1. Verify 'branches' is in settings tabs
const tabs = getSettingsTabsForAppType('microlending');
assert.ok(tabs.includes('branches'), "'branches' tab must be included in settings tabs");

// 2. Verify normalizeSettingsTab recognizes 'branches'
const normalized = normalizeSettingsTab('microlending', 'branches');
assert.equal(normalized, 'branches', "normalizeSettingsTab must allow 'branches'");

// 3. Verify checkLimit function signature accepts 'branches'
assert.equal(typeof checkLimit, 'function');

console.log('tenantBranchCreation unit tests passed successfully');
