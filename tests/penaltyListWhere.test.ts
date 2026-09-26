import assert from 'node:assert/strict';
import { penaltyListWhere } from '../lib/penalties';

const scope = { tenantId: 'tenant-a', appType: 'microlending', branchId: 'branch-a' };
assert.deepEqual(penaltyListWhere(scope), { loan: scope });
assert.deepEqual(penaltyListWhere({ ...scope, status: 'pending', routeId: 'route-a', q: ' AB-1 ' }), {
  loan: scope,
  status: 'pending',
  customer: { routeId: 'route-a' },
  OR: [
    { loan: { loanCode: { contains: 'AB-1' } } },
    { customer: { name: { contains: 'AB-1' } } },
    { customer: { customerCode: { contains: 'AB-1' } } },
  ],
});
assert.deepEqual(penaltyListWhere({ ...scope, branchId: null, status: 'all' }), {
  loan: { tenantId: 'tenant-a', appType: 'microlending' },
});
console.log('Penalty list scope and filters passed');
