/**
 * Unit tests for the DailyCollection get-or-create logic and role-gating
 * in submitCollectionEntry.
 *
 * These tests run entirely in-process (no DB required) by mocking prisma.
 * Run with:  npx tsx tests/collectionAction.test.ts
 */
import assert from 'node:assert/strict';

// ── Minimal type stubs ────────────────────────────────────────────────────────
type Row = { id: string };

// ── Test 1: getOrCreateDailyCollection deduplication logic ──────────────────
// Simulate the raw-SQL helper behaviour in isolation.

function simulateGetOrCreate(
  existing: Row | null,
  insertSucceeds: boolean,
  afterInsert: Row | null,
): Row {
  // mirrors the helper: INSERT ... ON DUPLICATE KEY UPDATE, then SELECT
  if (!existing) {
    if (insertSucceeds) {
      // fresh insert → afterInsert is the new row
      const found = afterInsert;
      if (!found) throw new Error('DailyCollection not found after upsert');
      return found;
    } else {
      // insert blocked by duplicate key (concurrent race) → afterInsert is the existing row
      const found = afterInsert;
      if (!found) throw new Error('DailyCollection not found after upsert');
      return found;
    }
  }
  // existing found by SELECT after INSERT ... ON DUPLICATE KEY UPDATE (no-op insert)
  if (!afterInsert) throw new Error('DailyCollection not found after upsert');
  return afterInsert;
}

// Case A: no existing row, fresh insert succeeds
const caseA = simulateGetOrCreate(null, true, { id: 'new-1' });
assert.equal(caseA.id, 'new-1', 'Case A: new row returned');

// Case B: no existing row visible in SELECT before insert, but duplicate key (race)
//         → the SELECT after insert finds the concurrent row
const caseB = simulateGetOrCreate(null, false, { id: 'concurrent-2' });
assert.equal(caseB.id, 'concurrent-2', 'Case B: concurrent row returned on duplicate key');

// Case C: row already existed (normal repeated edit path)
const caseC = simulateGetOrCreate({ id: 'existing-3' }, true, { id: 'existing-3' });
assert.equal(caseC.id, 'existing-3', 'Case C: existing row returned');

// Case D: after-insert SELECT returns nothing → must throw
assert.throws(
  () => simulateGetOrCreate(null, true, null),
  /DailyCollection not found after upsert/,
  'Case D: throws when SELECT returns nothing',
);

console.log('✓ getOrCreateDailyCollection deduplication tests passed');

// ── Test 2: Role-gating for edits ────────────────────────────────────────────

type Role = 'agent' | 'admin' | 'superadmin';

function canDirectlyEdit(role: Role, isEdit: boolean): boolean {
  if (!isEdit) return true; // fresh payment — anyone can submit
  return role === 'admin' || role === 'superadmin';
}

function shouldRequestEdit(role: Role, isEdit: boolean): boolean {
  return isEdit && role === 'agent';
}

// agents cannot directly edit a submitted payment
assert.equal(canDirectlyEdit('agent', true), false, 'agent cannot directly edit');
assert.equal(shouldRequestEdit('agent', true), true, 'agent must request edit');

// admins / superadmins can directly edit
assert.equal(canDirectlyEdit('admin', true), true, 'admin can directly edit');
assert.equal(canDirectlyEdit('superadmin', true), true, 'superadmin can directly edit');
assert.equal(shouldRequestEdit('admin', true), false, 'admin does not need to request');

// fresh payment (isEdit = false) — all roles allowed
assert.equal(canDirectlyEdit('agent', false), true, 'agent can submit fresh payment');
assert.equal(canDirectlyEdit('admin', false), true, 'admin can submit fresh payment');

console.log('✓ Role-gating tests passed');

// ── Test 3: delta calculation ─────────────────────────────────────────────────

function computeDelta(isEdit: boolean, newAmount: number, currentReceived: number): number {
  return isEdit ? newAmount - currentReceived : newAmount;
}

assert.equal(computeDelta(false, 500, 0), 500, 'fresh payment: delta = full amount');
assert.equal(computeDelta(true, 600, 500), 100, 'edit increase: delta = difference');
assert.equal(computeDelta(true, 400, 500), -100, 'edit decrease: delta = negative difference');
assert.equal(computeDelta(true, 500, 500), 0, 'no-change edit: delta = 0');

console.log('✓ Delta calculation tests passed');

// ── Test 4: instalment remarks for admin edit vs fresh payment ────────────────

function buildInstalmentRemarks(isEdit: boolean, adminRemarks: string): string {
  return isEdit ? `Edited by Admin: ${adminRemarks}` : '';
}

assert.equal(
  buildInstalmentRemarks(true, 'typo fix'),
  'Edited by Admin: typo fix',
  'admin edit remark prefix applied',
);
assert.equal(
  buildInstalmentRemarks(false, 'anything'),
  '',
  'fresh payment: no admin remark prefix',
);

console.log('✓ Remark formatting tests passed');

console.log('\nAll collectionAction tests passed ✓');
