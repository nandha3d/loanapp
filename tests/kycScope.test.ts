import assert from 'node:assert/strict';
import { kycCustomerWhere } from '../lib/kyc';

const actor = {
  tenantId: 'tenant-a',
  appType: 'microlending',
  branchId: 'branch-a',
  userId: 'staff-a',
  role: 'admin',
};

assert.deepEqual(kycCustomerWhere(actor, 'customer-a'), {
  id: 'customer-a',
  tenantId: 'tenant-a',
  appType: 'microlending',
  branchId: 'branch-a',
});
assert.deepEqual(kycCustomerWhere({ ...actor, branchId: null }), {
  tenantId: 'tenant-a',
  appType: 'microlending',
});
assert.deepEqual(kycCustomerWhere({ ...actor, role: 'agent', userId: 'agent-a' }), {
  tenantId: 'tenant-a',
  appType: 'microlending',
  AND: [{ OR: [
    { agentId: 'agent-a' },
    { route: { assignedAgentId: 'agent-a' } },
    { route: { routeAgents: { some: { agentId: 'agent-a' } } } },
  ] }],
});

console.log('KYC scope: tenant, module, branch and agent linkage passed');
