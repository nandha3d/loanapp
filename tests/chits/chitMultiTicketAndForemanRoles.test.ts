import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_ROLE_TEMPLATES,
  EMPTY_STAFF_PERMISSIONS,
  canStaffVisitPage,
  decodePermissionClaims,
  encodePermissionClaims,
  hasAnyCustomStaffPermission,
  hasStaffPermission,
  mergeStaffPermissions,
  parseStaffPermissions,
  serializeStaffPermissions,
} from '@/lib/staffPermissions';
import {
  CHIT_FORM_TOOLTIPS,
  formatChitTenure,
  getChitFieldTooltip,
  getChitFormUiStrings,
  type SupportedChitLang,
} from '@/lib/chits/formTooltipsI18n';
import {
  canAdminChits,
  canApproveChitSecurity,
  canConductChitAuction,
  canReleaseChitPayout,
  canViewChits,
} from '@/lib/chits/access';
import { getRoleRedirectTarget } from '@/proxy';

const ROOT = process.cwd();
function readRel(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf8');
}

// 1. Untouched agent MUST remain restricted (STABLE-2)
const untouched = parseStaffPermissions(null);
assert.equal(hasAnyCustomStaffPermission(untouched), false);
assert.equal(canViewChits('agent', untouched), false);
assert.equal(canAdminChits('agent', untouched), false);
assert.equal(canConductChitAuction('agent', untouched), false);
assert.equal(canApproveChitSecurity('agent', untouched), false);
assert.equal(canReleaseChitPayout('agent', untouched), false);
assert.equal(getRoleRedirectTarget('/chitfunds/chits', 'agent', false, untouched), '/chitfunds/collection');
assert.equal(getRoleRedirectTarget('/chitfunds/foreman', 'agent', false, untouched), null);
assert.equal(canStaffVisitPage('/foreman', untouched), false);
assert.equal(getRoleRedirectTarget('/chitfunds/reports', 'agent', false, untouched), '/chitfunds/collection');
assert.equal(getRoleRedirectTarget('/chitfunds/dashboard', 'agent', false, untouched), '/chitfunds/collection');

// 2. Customized roles: Co-Foreman & Head Foreman
const coForemanTpl = DEFAULT_ROLE_TEMPLATES.find((t) => t.key === 'co_foreman')!;
const coForemanPerms = parseStaffPermissions(coForemanTpl.permissions);
assert.equal(canViewChits('agent', coForemanPerms), true);
assert.equal(canConductChitAuction('agent', coForemanPerms), true);
assert.equal(canAdminChits('agent', coForemanPerms), false);
assert.equal(canApproveChitSecurity('agent', coForemanPerms), false);
assert.equal(canReleaseChitPayout('agent', coForemanPerms), false);
assert.equal(getRoleRedirectTarget('/chitfunds/foreman', 'agent', false, coForemanPerms), null);
assert.equal(getRoleRedirectTarget('/chitfunds/chits', 'agent', false, coForemanPerms), null);
assert.equal(getRoleRedirectTarget('/chitfunds/reports', 'agent', false, coForemanPerms), null);
// Without canManageChits, creation and settings remain blocked
assert.equal(getRoleRedirectTarget('/chitfunds/chits/new', 'agent', false, coForemanPerms), '/chitfunds/collection');
assert.equal(getRoleRedirectTarget('/chitfunds/settings', 'agent', false, coForemanPerms), '/chitfunds/collection');

// Head Foreman merged with custom role template + explicit override
const headForemanTpl = DEFAULT_ROLE_TEMPLATES.find((t) => t.key === 'head_foreman')!;
const mergedHead = mergeStaffPermissions(JSON.stringify(headForemanTpl.permissions), JSON.stringify(EMPTY_STAFF_PERMISSIONS));
assert.equal(canAdminChits('agent', mergedHead), true);
assert.equal(canApproveChitSecurity('agent', mergedHead), true);
assert.equal(canReleaseChitPayout('agent', mergedHead), true);
assert.equal(hasStaffPermission('agent', mergedHead, 'canManageChits'), true);
assert.equal(getRoleRedirectTarget('/chitfunds/chits/new', 'agent', false, mergedHead), null);
assert.equal(getRoleRedirectTarget('/chitfunds/dashboard', 'agent', false, mergedHead), null);
assert.equal(getRoleRedirectTarget('/chitfunds/settings', 'agent', false, mergedHead), '/chitfunds/collection');

// JWT compact claim round-trip preserves exact flags
const claims = encodePermissionClaims(coForemanPerms);
const decoded = decodePermissionClaims(claims);
assert.deepEqual(decoded, coForemanPerms);
assert.equal(serializeStaffPermissions(coForemanPerms), JSON.stringify(coForemanPerms));

// Existing admin restrictions stay intact unless superadmin/developer
assert.equal(canApproveChitSecurity('admin', null), false);
assert.equal(canReleaseChitPayout('admin', null), false);
assert.equal(canApproveChitSecurity('superadmin', null), true);
assert.equal(canReleaseChitPayout('superadmin', null), true);

// Tenant-wide Superadmin policy toggles enable Admin approval & payout when switched ON
assert.equal(canApproveChitSecurity('admin', null, { adminCanApproveSecurity: true }), true);
assert.equal(canApproveChitSecurity('admin', null, { adminCanApproveSecurity: false }), false);
assert.equal(canReleaseChitPayout('admin', null, { adminCanReleasePayout: true }), true);
assert.equal(canReleaseChitPayout('admin', null, { adminCanReleasePayout: false }), false);
// Per-admin staffPermissions override also works even when tenant-wide policy is OFF
assert.equal(canApproveChitSecurity('admin', parseStaffPermissions({ canApproveSecurity: true })), true);
assert.equal(canReleaseChitPayout('admin', parseStaffPermissions({ canReleasePayout: true })), true);
// Foreman / Staff (agent) remain scoped by their own staffPermissions, unaffected by Admin tenant toggle
assert.equal(canApproveChitSecurity('agent', null, { adminCanApproveSecurity: true }), false);
assert.equal(canReleaseChitPayout('agent', null, { adminCanReleasePayout: true }), false);

// 3. Auto-tenure localization across all 6 languages & frequencies
const LANGS: SupportedChitLang[] = ['en', 'ta', 'hi', 'te', 'kn', 'ml'];
for (const l of LANGS) {
  const m = formatChitTenure(10, { unit: 'month', interval: 1 }, l);
  const w = formatChitTenure(12, { unit: 'week', interval: 1 }, l);
  const d = formatChitTenure(30, { unit: 'day', interval: 1 }, l);
  const fn = formatChitTenure(10, { unit: 'week', interval: 2 }, l);
  const custom = formatChitTenure(10, { unit: 'day', interval: 15 }, l);
  assert.ok(m.startsWith('10 '), `monthly tenure missing count in ${l}: ${m}`);
  assert.ok(w.startsWith('12 '), `weekly tenure missing count in ${l}: ${w}`);
  assert.ok(d.startsWith('30 '), `daily tenure missing count in ${l}: ${d}`);
  assert.ok(fn.includes('20 '), `fortnightly tenure missing total weeks in ${l}: ${fn}`);
  assert.ok(custom.includes('150 '), `custom tenure missing 150 days in ${l}: ${custom}`);

  const ui = getChitFormUiStrings(l);
  assert.ok(ui.basicDetails.length > 0, `empty ui strings in ${l}`);
  assert.ok(ui.foremenAndCommission.length > 0);
}

// 4. All tooltip keys must have non-empty strings across all 6 languages
for (const key of Object.keys(CHIT_FORM_TOOLTIPS) as Array<keyof typeof CHIT_FORM_TOOLTIPS>) {
  for (const l of LANGS) {
    const text = getChitFieldTooltip(key, l);
    assert.ok(text.trim().length > 10, `tooltip "${key}" missing or too short in "${l}"`);
  }
}

// 5. Schema, Multi-Ticket, and Multi-Foreman static guards
const schema = readRel('prisma/schema.prisma');
assert.ok(!schema.includes('@@unique([chitGroupId, customerId])'), 'schema must allow multiple tickets per customer');
assert.ok(schema.includes('@@index([chitGroupId, customerId]'), 'schema must retain non-unique composite index');
assert.ok(schema.includes('model CustomRole'), 'schema must define CustomRole');
assert.ok(schema.includes('model ChitGroupForeman'), 'schema must define ChitGroupForeman');

const migrationSql = readRel('prisma/migrations/20261125200000_chit_multi_ticket_foreman_roles/migration.sql');
const createIdxPos = migrationSql.indexOf('CREATE INDEX `chit_members_chit_group_id_customer_id_idx`');
const dropIdxPos = migrationSql.indexOf('DROP INDEX `chit_members_chit_group_id_customer_id_key`');
assert.ok(createIdxPos !== -1 && dropIdxPos !== -1 && createIdxPos < dropIdxPos, 'SQL migration must create composite index before dropping unique FK index');

const chitActions = readRel('app/(dashboard)/[module]/chits/actions.ts');
assert.ok(!chitActions.includes("Array.from(new Set(formData.getAll('memberIds')"), 'createChitGroup must allow duplicate customerIds');
assert.ok(chitActions.includes('chitGroupForeman'), 'createChitGroup must persist multi-foreman rows');
assert.ok(chitActions.includes('addChitMemberTicketsAction'), 'multi-ticket action must be exported');

const v1ChitsRoute = readRel('app/api/v1/chits/route.ts');
assert.ok(!v1ChitsRoute.includes('new Set((body?.memberIds'), 'v1 POST /chits must allow multiple tickets per customer');

console.log('✅ chitMultiTicketAndForemanRoles tests passed (permissions, 6-lang tooltips/tenure, multi-ticket & multi-foreman)');
