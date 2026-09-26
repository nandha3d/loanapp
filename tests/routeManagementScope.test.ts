import assert from 'node:assert/strict';
import { routeWhere } from '../lib/routes/service';

const actor = {
  tenantId: 'tenant-a',
  appType: 'microlending',
  branchId: 'branch-a',
  userId: 'staff-a',
  role: 'admin',
};

assert.deepEqual(routeWhere(actor, 'route-a'), {
  id: 'route-a', tenantId: 'tenant-a', appType: 'microlending', branchId: 'branch-a',
});
assert.deepEqual(routeWhere({ ...actor, role: 'superadmin', branchId: null }), {
  tenantId: 'tenant-a', appType: 'microlending',
});
assert.deepEqual(routeWhere({ ...actor, role: 'agent', userId: 'agent-a' }), {
  tenantId: 'tenant-a', appType: 'microlending',
  OR: [
    { assignedAgentId: 'agent-a' },
    { routeAgents: { some: { agentId: 'agent-a' } } },
  ],
});

console.log('Route scope: tenant, module, active branch and agent linkage passed');
