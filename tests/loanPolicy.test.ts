import assert from 'node:assert/strict';
import {
  buildAgentCustomerAccessWhere,
  buildLoanDetailWhere,
  canAgentAccessCustomer,
  canCreateLoanForRole,
  validateLoanNumericInputs,
} from '../lib/loanPolicy';

assert.equal(canCreateLoanForRole('admin'), true, 'admin can create loans');
assert.equal(canCreateLoanForRole('superadmin'), true, 'superadmin can create loans');
assert.equal(canCreateLoanForRole('developer'), true, 'developer can create loans');
assert.equal(canCreateLoanForRole('agent'), true, 'agent can submit loan applications for admin approval');
assert.equal(canCreateLoanForRole(undefined), false, 'missing role cannot create loans');

assert.deepEqual(
  validateLoanNumericInputs({
    principal: 1000,
    rate: 100,
    tenure: 10,
    penaltyRate: 25,
  }),
  { valid: true },
  'valid positive loan numbers are accepted',
);

assert.equal(
  validateLoanNumericInputs({ principal: 0, rate: 100, tenure: 10, penaltyRate: 25 }).valid,
  false,
  'zero principal is rejected',
);
assert.equal(
  validateLoanNumericInputs({ principal: 1000, rate: -1, tenure: 10, penaltyRate: 25 }).valid,
  false,
  'negative deduction/rate is rejected',
);
assert.equal(
  validateLoanNumericInputs({ principal: 1000, rate: 100, tenure: 0, penaltyRate: 25 }).valid,
  false,
  'zero tenure is rejected',
);
assert.equal(
  validateLoanNumericInputs({ principal: 1000, rate: 100, tenure: 10, penaltyRate: -1 }).valid,
  false,
  'negative penalty is rejected',
);

assert.deepEqual(
  buildAgentCustomerAccessWhere({ userId: 'agent-1' }),
  {
    OR: [
      { agentId: 'agent-1' },
      { route: { assignedAgentId: 'agent-1' } },
      { route: { routeAgents: { some: { agentId: 'agent-1' } } } },
    ],
  },
  'agent customer access includes direct and route-based ownership',
);

assert.equal(
  canAgentAccessCustomer({ agentId: 'agent-1', routeId: null }, [], 'agent-1'),
  true,
  'agent can access directly assigned route-less customers',
);

assert.equal(
  canAgentAccessCustomer({ agentId: null, routeId: 'route-1' }, ['route-1'], 'agent-1'),
  true,
  'agent can access customers on assigned routes',
);

assert.equal(
  canAgentAccessCustomer({ agentId: null, routeId: null }, [], 'agent-1'),
  false,
  'agent cannot access unrelated route-less customers',
);

assert.deepEqual(
  buildLoanDetailWhere({
    loanId: 'loan-1',
    tenantId: 'tenant-1',
    appType: 'microlending',
    branchId: 'branch-1',
    role: 'admin',
    userId: 'admin-1',
  }),
  {
    loanCode: 'loan-1',
    tenantId: 'tenant-1',
    appType: 'microlending',
    branchId: 'branch-1',
  },
  'admin loan detail lookup is tenant, app, and branch scoped',
);

assert.deepEqual(
  buildLoanDetailWhere({
    loanId: 'loan-1',
    tenantId: 'tenant-1',
    appType: 'microlending',
    branchId: 'branch-1',
    role: 'agent',
    userId: 'agent-1',
  }),
  {
    loanCode: 'loan-1',
    tenantId: 'tenant-1',
    appType: 'microlending',
    branchId: 'branch-1',
    customer: {
      OR: [
        { agentId: 'agent-1' },
        { route: { assignedAgentId: 'agent-1' } },
        { route: { routeAgents: { some: { agentId: 'agent-1' } } } },
      ],
    },
  },
  'agent loan detail lookup is scoped to directly assigned and shared-route customers',
);

assert.deepEqual(
  buildLoanDetailWhere({
    loanId: 'loan-1',
    tenantId: 'tenant-1',
    appType: 'microlending',
    branchId: null,
    role: 'agent',
    userId: undefined,
  }),
  {
    loanCode: 'loan-1',
    tenantId: 'tenant-1',
    appType: 'microlending',
    customer: { id: '__unauthorized_agent__' },
  },
  'agent without a user id cannot match any loan detail',
);

console.log('loan policy tests passed');
