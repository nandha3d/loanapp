import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const loanActions = readFileSync('app/(dashboard)/[module]/loans/actions.ts', 'utf8');
const customerActions = readFileSync('app/(dashboard)/[module]/customers/actions.ts', 'utf8');
const approvalActions = readFileSync('app/(dashboard)/[module]/approvals/actions.ts', 'utf8');

assert.equal(
  /select:\s*\{\s*canCreateLoan/.test(loanActions) || /agentUser\?\.canCreateLoan/.test(loanActions),
  false,
  'agents should not be blocked by a direct loan creation toggle',
);

assert.match(
  loanActions,
  /status:\s*role === 'agent' \? 'pending_review' : 'active'/,
  'agent-created loans should enter pending review',
);

assert.match(
  loanActions,
  /type:\s*'loan_review'[\s\S]*?targetRole:\s*'admin'/,
  'agent-created loans should notify admins for review',
);

assert.match(
  customerActions,
  /status:\s*userRole === 'agent' \? 'pending_review' : 'active'/,
  'agent-created customers should enter pending review',
);

assert.match(
  approvalActions,
  /targetRole:\s*'agent'[\s\S]*?type:\s*`loan_\$\{label\}`/,
  'loan review decisions should notify the requesting agent',
);

assert.match(
  approvalActions,
  /type:\s*'customer_approved'[\s\S]*?targetRole:\s*'agent'/,
  'customer approval should notify the requesting agent',
);

assert.match(
  approvalActions,
  /targetRole:\s*'agent'[\s\S]*?type:\s*'customer_rejected'/,
  'customer rejection should notify the requesting agent',
);

console.log('agent approval flow tests passed');
