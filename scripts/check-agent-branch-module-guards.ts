import assert from 'node:assert/strict';
import {
  resolveAgentTargetBranchId,
  validateAgentModuleSelection,
} from '@/lib/agentModuleAssignment';

assert.deepEqual(
  resolveAgentTargetBranchId({
    actorRole: 'developer',
    activeBranchId: null,
    requestedBranchId: null,
  }),
  { ok: false, error: 'Select a branch before saving an agent.' },
  'developer-created agents must not be saved without an explicit branch',
);

assert.deepEqual(
  resolveAgentTargetBranchId({
    actorRole: 'developer',
    activeBranchId: null,
    requestedBranchId: 'branch_1',
  }),
  { ok: true, branchId: 'branch_1' },
  'developer-created agents use the requested branch',
);

assert.deepEqual(
  resolveAgentTargetBranchId({
    actorRole: 'admin',
    activeBranchId: 'branch_admin',
    requestedBranchId: 'branch_other',
  }),
  { ok: true, branchId: 'branch_admin' },
  'branch admins use their active branch, not a posted branch override',
);

assert.deepEqual(
  validateAgentModuleSelection([], JSON.stringify(['microlending'])),
  { ok: false, error: 'Select at least one module before saving an agent.' },
  'agents must have at least one selected module',
);

assert.deepEqual(
  validateAgentModuleSelection(['chitfunds'], JSON.stringify(['microlending'])),
  { ok: false, error: 'Modules not enabled for this branch: chitfunds' },
  'agent modules must be enabled on the target branch',
);

assert.deepEqual(
  validateAgentModuleSelection(['microlending'], JSON.stringify(['microlending', 'goldloan'])),
  { ok: true, modules: ['microlending'] },
  'valid branch modules are accepted',
);

console.log('agent branch/module guard tests passed');
