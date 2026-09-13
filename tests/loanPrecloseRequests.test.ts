import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { en } from '../i18n/en';
import { ALL_MODULES } from '../types/modules';
import { canRequestLoanPreclose, isPrecloseRequestLoan, isValidPrecloseAmount, precloseOutstanding } from '../lib/loanPreclosePolicy';

for (const appType of ALL_MODULES) {
  assert.equal(canRequestLoanPreclose('agent', appType, true), appType === 'microlending');
  assert.equal(canRequestLoanPreclose('agent', appType, false), false);
}
for (const role of ['admin', 'superadmin', 'developer', 'borrower', '']) assert.equal(canRequestLoanPreclose(role, 'microlending', true), false);
assert.equal(precloseOutstanding({ totalPayable: '10000.50', totalCollected: '2500.25' }), 7500.25);
assert.equal(precloseOutstanding({ totalPayable: 100, totalCollected: 200 }), 0);
for (const amount of [NaN, Infinity, -1, 0, 7500, 7501, '7500.25']) assert.equal(isValidPrecloseAmount(amount, 7500.25), false);
assert.equal(isValidPrecloseAmount(7500.25, 7500.25), true);
for (const status of ['closed', 'pending_review', 'npa', 'rejected', 'foreclosed']) assert.equal(isPrecloseRequestLoan({ status, deductionType: 'upfront_fixed' }), false);
for (const status of ['active', 'overdue']) assert.equal(isPrecloseRequestLoan({ status, deductionType: 'upfront_fixed' }), true);
assert.equal(isPrecloseRequestLoan({ status: 'active', deductionType: 'interest_only' }), false);

// Exercise the real workflow against an in-memory transaction boundary. Only
// infrastructure and the unchanged settlement engine are replaced; no DB needed.
const agent = { tenantId: 'tenant-a', appType: 'microlending', branchId: 'agent-branch', userId: 'agent-a', role: 'agent' };
const admin = { ...agent, branchId: 'loan-branch', userId: 'admin-a', role: 'admin' };
const originalLoan = { id: 'loan-a', tenantId: agent.tenantId, appType: agent.appType, branchId: 'loan-branch',
  customer: { name: 'Test borrower', agentId: agent.userId }, status: 'active', deductionType: 'upfront_fixed',
  loanCode: 'DL-TEST', totalPayable: 10000, totalCollected: 2500 };
let loan = { ...originalLoan };
let requests: any[] = [];
let audits: any[] = [];
let settlements: any[] = [];
let notices: any[] = [];
let enabled = true;
let inTransaction = false;
let failSettlement = false;
let loanWhere: any;
let queryLocks = 0;
const matches = (row: any, where: any) => Object.entries(where).every(([key, value]) => row[key] === value);
const tx = {
  $queryRaw: async () => { queryLocks++; return [{ id: loan.id }]; },
  loan: {
    findFirst: async ({ where }: any) => {
      loanWhere = where;
      const { customer, ...scope } = where;
      return matches(loan, scope) && (!customer || customer.OR.some((arm: any) => arm.agentId === loan.customer.agentId)) ? loan : null;
    },
    findMany: async ({ where }: any) => { const { id, ...scope } = where; return matches(loan, scope) && (!id || id.in.includes(loan.id)) ? [{ id: loan.id }] : []; },
  },
  approvalRequest: {
    findMany: async ({ where }: any) => requests.filter(row => matches(row, where)),
    findFirst: async ({ where }: any) => requests.find(row => matches(row, where)) ?? null,
    create: async ({ data }: any) => { const row = { ...data, id: `request-${requests.length}`, status: 'pending' }; requests.push(row); return row; },
    updateMany: async ({ where, data }: any) => { const rows = requests.filter(row => matches(row, where)); rows.forEach(row => Object.assign(row, data)); return { count: rows.length }; },
  },
  auditLog: { create: async ({ data }: any) => { audits.push(data); } },
};
const db = { ...tx, $transaction: async (fn: any) => {
  const before = structuredClone({ loan, requests, audits, settlements });
  inTransaction = true;
  try { return await fn(tx); }
  catch (e) { ({ loan, requests, audits, settlements } = before); throw e; }
  finally { inTransaction = false; }
} };
const notify = async (notice: any) => { assert.equal(inTransaction, false, 'notify only after commit'); notices.push(notice); };
const stubs: Record<string, any> = {
  './db': { __esModule: true, default: db }, './tenant': { getSetting: async () => enabled ? '1' : '0' },
  './i18n': { getDictionary: async () => en }, './notify/approvers': { notifyApprovers: notify }, './notify/userNotify': { notifyUser: notify },
  './loanPreclose': { precloseLoanInTx: async (transaction: any, ctx: any, subject: any, input: any) => {
    assert.equal(transaction, tx); assert.equal(inTransaction, true);
    if (failSettlement) throw Error('simulated settlement failure');
    settlements.push({ ctx, loanId: subject.id, ...input }); loan.status = 'closed'; loan.totalCollected += input.amount;
  } },
};
const loader = (Module as any)._load;
(Module as any)._load = function(name: string, parent: any, ...args: any[]) {
  if (parent?.filename.replaceAll('\\', '/').endsWith('/lib/loanPrecloseRequests.ts') && stubs[name]) return stubs[name];
  return loader.call(this, name, parent, ...args);
};
const { submitLoanPrecloseRequest, reviewLoanPrecloseRequest, precloseApprovalVisibility } = createRequire(import.meta.url)('../lib/loanPrecloseRequests');
(Module as any)._load = loader;
const body = { entityType: 'loan', entityId: loan.id, requestedChanges: { amount: 7500, paymentMode: 'cash', remarks: 'test' }, reason: 'Full settlement requested' };
const reset = () => { loan = { ...originalLoan }; requests = []; audits = []; settlements = []; notices = []; enabled = true; failSettlement = false; };

async function main() {
  const rejected = async (fn: () => Promise<unknown>, status: number) => assert.rejects(fn, (error: any) => error.status === status);
  enabled = false;
  await rejected(() => submitLoanPrecloseRequest(agent, body), 403);
  enabled = true;
  await rejected(() => submitLoanPrecloseRequest({ ...agent, appType: 'goldloan' }, body), 403);
  await rejected(() => submitLoanPrecloseRequest({ ...agent, tenantId: 'other' }, body), 404);
  await rejected(() => submitLoanPrecloseRequest({ ...agent, userId: 'other' }, body), 404);
  await rejected(() => submitLoanPrecloseRequest(agent, { ...body, reason: ' ' }), 400);
  await rejected(() => submitLoanPrecloseRequest(agent, { ...body, requestedChanges: '{broken' }), 400);
  await rejected(() => submitLoanPrecloseRequest(agent, { ...body, requestedChanges: { ...body.requestedChanges, amount: 1 } }), 409);
  const request = await submitLoanPrecloseRequest(agent, body);
  assert.equal(loanWhere.branchId, undefined, 'agent scope follows customer linkage');
  assert.equal(settlements.length, 0); assert.equal(loan.status, 'active');
  assert.equal(notices[0].branchId, 'loan-branch'); assert.equal(notices[0].requesterBranchId, 'agent-branch');
  assert.equal(notices[0].requesterRole, 'agent'); assert.equal(audits.length, 1);
  await rejected(() => submitLoanPrecloseRequest(agent, body), 409);
  await rejected(() => reviewLoanPrecloseRequest(agent, request.id, 'approve', ''), 403);
  for (const role of ['admin', 'superadmin', 'developer']) await rejected(() => reviewLoanPrecloseRequest({ ...admin, role, branchId: 'other' }, request.id, 'approve', ''), 404);
  loan.totalCollected = 2600;
  await rejected(() => reviewLoanPrecloseRequest(admin, request.id, 'approve', ''), 409);
  assert.equal(requests[0].status, 'pending', 'stale review rolls back its claim');
  loan.totalCollected = 2500; failSettlement = true;
  await assert.rejects(() => reviewLoanPrecloseRequest(admin, request.id, 'approve', ''), /simulated/);
  assert.equal(requests[0].status, 'pending'); assert.equal(notices.length, 1);
  failSettlement = false;
  await reviewLoanPrecloseRequest(admin, request.id, 'approve', 'Approved');
  assert.equal(settlements.length, 1); assert.equal(settlements[0].amount, 7500); assert.equal(settlements[0].ctx.userId, admin.userId);
  assert.equal(loan.totalCollected, 10000); assert.equal(loan.status, 'closed'); assert.equal(requests[0].status, 'approved');
  assert.equal(notices[1].targetUserId, agent.userId);
  await rejected(() => reviewLoanPrecloseRequest(admin, request.id, 'approve', ''), 404);
  assert.equal(settlements.length, 1, 'a reviewed request never settles twice');
  reset();
  const again = await submitLoanPrecloseRequest(agent, body);
  enabled = false;
  await rejected(() => reviewLoanPrecloseRequest(admin, again.id, 'approve', ''), 403);
  await reviewLoanPrecloseRequest(admin, again.id, 'reject', 'Declined');
  assert.equal(settlements.length, 0); assert.equal(loan.totalCollected, 2500); assert.equal(requests[0].status, 'rejected');
  enabled = true;
  await submitLoanPrecloseRequest(agent, body);
  assert.equal(requests.length, 2, 'rejection permits a fresh request and preserves history');
  assert.deepEqual((await precloseApprovalVisibility(agent.tenantId, agent.appType, 'other')).entityId.in, []);
  assert.deepEqual((await precloseApprovalVisibility(agent.tenantId, agent.appType, loan.branchId)).entityId.in, [loan.id]);
  assert.ok(queryLocks > 0);
  const read = (path: string) => readFileSync(path, 'utf8');
  assert.match(read('app/api/v1/loans/[id]/preclose/route.ts'), /if \(ctx.role === 'agent'\)[\s\S]*?return fail\('Unauthorized', 403\)/);
  assert.match(read('lib/loanPreclose.ts'), /loan.appType === 'microlending'[\s\S]*FOR UPDATE[\s\S]*tx.instalment.findMany/);
  for (const path of ['app/(dashboard)/[module]/approvals/actions.ts', 'app/api/v1/approvals/[id]/approve/route.ts', 'app/api/v1/approvals/[id]/reject/route.ts']) assert.match(read(path), /reviewLoanPrecloseRequest/);
  assert.match(read('app/api/approvals/[id]/review/route.ts'), /approval.requestType === LOAN_PRECLOSE_REQUEST.*403/);
  console.log('Loan preclose request policy, workflow, rollback, scope, and replay checks passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
