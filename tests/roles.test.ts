import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  canManageAdmins,
  canManageUser,
  isPrimaryAdmin,
  roleLabel,
  roleRank,
} from '../lib/roles';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

const agent = { role: 'agent' };
const admin = { role: 'admin' };
const primary = { role: 'admin', isPrimaryAdmin: true };
const superadmin = { role: 'superadmin' };
const developer = { role: 'developer' };

// ── Ranking ──────────────────────────────────────────────────────────────
assert.ok(roleRank(agent) < roleRank(admin), 'agent ranks below admin');
assert.ok(roleRank(admin) < roleRank(primary), 'admin ranks below primary admin');
assert.ok(roleRank(primary) < roleRank(superadmin), 'primary admin ranks below superadmin');
assert.ok(roleRank(superadmin) < roleRank(developer), 'superadmin ranks below developer');
assert.equal(roleRank(null), 0, 'an absent user has no rank');
assert.equal(roleRank({ role: 'nonsense' }), 0, 'an unknown role has no rank');

// The flag only promotes admins — it must never lift an agent.
assert.equal(
  roleRank({ role: 'agent', isPrimaryAdmin: true }),
  roleRank(agent),
  'isPrimaryAdmin on a non-admin is ignored',
);
assert.equal(isPrimaryAdmin({ role: 'agent', isPrimaryAdmin: true }), false, 'only admins can be primary');
assert.equal(isPrimaryAdmin(primary), true, 'a flagged admin is a primary admin');
assert.equal(isPrimaryAdmin(admin), false, 'a plain admin is not primary');

// ── Who may manage admins ────────────────────────────────────────────────
assert.equal(canManageAdmins(agent), false, 'agents cannot manage admins');
assert.equal(canManageAdmins(admin), false, 'a plain admin cannot create peer admins');
assert.equal(canManageAdmins(primary), true, 'a primary admin manages admins');
assert.equal(canManageAdmins(superadmin), true, 'superadmins manage admins');
assert.equal(canManageAdmins(developer), true, 'developers manage admins');

// ── Peer protection ──────────────────────────────────────────────────────
assert.equal(canManageUser(primary, admin), true, 'a primary admin may edit a plain admin');
assert.equal(canManageUser(primary, agent), true, 'a primary admin may edit an agent');
assert.equal(canManageUser(primary, primary), false, 'primary admins cannot edit each other');
assert.equal(canManageUser(primary, superadmin), false, 'a primary admin cannot edit a superadmin');
assert.equal(canManageUser(admin, admin), false, 'plain admins cannot edit each other');
assert.equal(canManageUser(superadmin, primary), true, 'a superadmin outranks a primary admin');

assert.equal(roleLabel(primary), 'Primary Admin', 'primary admins are labelled distinctly');
assert.equal(roleLabel(admin), 'Admin', 'plain admins keep the admin label');

// ── Guard wiring ─────────────────────────────────────────────────────────
// Primary admin is a FLAG on role 'admin', never its own role string — a new
// role value would have bypassed every `role === 'admin'` guard in the app.
const schema = read('prisma/schema.prisma');
assert.match(
  schema,
  /isPrimaryAdmin\s+Boolean\s+@default\(false\)\s+@map\("is_primary_admin"\)/,
  'the primary-admin flag is persisted on User',
);

const adminActions = read('app/admin/actions.ts');
assert.match(adminActions, /canManageAdmins\(actor\)/, 'user management is gated by rank, not a role literal');
assert.match(
  adminActions,
  /Only a Super Admin can appoint a Primary Admin/,
  'a primary admin cannot appoint another primary admin',
);
assert.match(
  adminActions,
  /!canManageUser\(actor, targetUser\)/,
  'a primary admin may only edit strictly lower-ranked users',
);

const settingsActions = read('app/(dashboard)/[module]/settings/actions.ts');
assert.match(
  settingsActions,
  /Only a Primary Admin or Super Admin can create admin accounts/,
  'plain admins can no longer mint peer admins',
);

console.log('role hierarchy tests passed');
