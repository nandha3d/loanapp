import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  computeLoanFunding,
  fillTemplate,
  fundingAlertsApply,
  newlyFundableLoans,
  LOAN_FUNDING_ALERTS_FLAG,
} from '../lib/loanFundingPolicy';
import { FEATURE_FLAG_KEYS } from '../lib/features';

const read = (path: string) => readFileSync(path, 'utf8');

// ── FUND-1: agent float ─────────────────────────────────────────────
// Float 20,000; this loan pays 30,000; other pending loans already need 15,000;
// branch pool 12,000.
const agent = computeLoanFunding({
  source: 'agent', required: 30_000, available: 20_000, committed: 15_000,
  branchId: 'b1', branchPool: 12_000, agentId: 'a1',
});
assert.equal(agent.shortfall, 10_000, 'shortfall = required − float');
assert.equal(agent.queueShortfall, 25_000, 'queue = required + committed − float');
assert.equal(agent.capitalNeeded, 0, 'pool 12,000 covers the 10,000 release');
assert.equal(agent.queueCapitalNeeded, 13_000, 'pool 12,000 short of the 25,000 queue release by 13,000');
assert.equal(agent.sufficient, false);
assert.equal(agent.agentId, 'a1');

// Float covers the loan, but not the queue: approval is not blocked.
const covered = computeLoanFunding({ source: 'agent', required: 5_000, available: 8_000, committed: 6_000, branchPool: 0 });
assert.equal(covered.shortfall, 0);
assert.equal(covered.queueShortfall, 3_000);
assert.equal(covered.sufficient, true);

// Exactly enough is enough (float may reach 0, never below — MONEY-16).
assert.equal(computeLoanFunding({ source: 'agent', required: 4_500, available: 4_500 }).sufficient, true);

// Paise rounding: each input rounds to paise first (1000.01 − 999.99).
const paise = computeLoanFunding({ source: 'agent', required: 1000.005, available: 999.994 });
assert.equal(paise.shortfall, 0.02);

// Agent with no branch: a release cannot happen, so no capital figure.
const noBranch = computeLoanFunding({ source: 'agent', required: 9_000, available: 1_000, branchPool: null });
assert.equal(noBranch.shortfall, 8_000);
assert.equal(noBranch.capitalNeeded, 0);

// ── FUND-1: branch pool (admin/superadmin) ──────────────────────────
const branch = computeLoanFunding({ source: 'branch', required: 50_000, available: 32_500, branchId: 'b1', branchPool: 32_500, committed: 99_999 });
assert.equal(branch.shortfall, 17_500);
assert.equal(branch.capitalNeeded, 17_500, 'capital to add = the pool shortfall');
assert.equal(branch.committed, 0, 'a branch has no agent queue');
assert.equal(branch.queueShortfall, 17_500);

// No cash leg / zero payout: never blocked.
assert.equal(computeLoanFunding({ source: 'none', required: 10_000 }).sufficient, true);
assert.equal(computeLoanFunding({ source: 'branch', required: 0, available: -5 }).shortfall, 0);

// ── FUND-5: newly fundable after a release ──────────────────────────
const loans = [
  { id: 'L1', disbursed: 4_000 },
  { id: 'L2', disbursed: 9_000 },
  { id: 'L3', disbursed: 15_000 },
  { id: 'L4', disbursed: 0 },
];
assert.deepEqual(newlyFundableLoans(loans, 5_000, 10_000).map((l) => l.id), ['L2'], 'L1 already fit; L3 still does not');
assert.deepEqual(newlyFundableLoans(loans, 0, 15_000).map((l) => l.id), ['L1', 'L2', 'L3']);
assert.deepEqual(newlyFundableLoans(loans, 10_000, 10_000), [], 'no change, no alert');

// ── Flag and template ───────────────────────────────────────────────
assert.equal(fundingAlertsApply('microlending', true), true);
assert.equal(fundingAlertsApply('microlending', false), false, 'off by default (STABLE-2)');
assert.equal(fundingAlertsApply('goldloan', true), false, 'Micro Lending only');
assert.ok(FEATURE_FLAG_KEYS.includes(LOAN_FUNDING_ALERTS_FLAG), 'flag reachable from Settings → Features');
assert.equal(fillTemplate('Release {amount} for {loanCode} {x}', { amount: '₹5', loanCode: 'DL1' }), 'Release ₹5 for DL1 {x}');

// ── Wiring guards ───────────────────────────────────────────────────
const origination = read('app/api/v1/loans/route.ts');
assert.match(origination, /failWithData\(`Insufficient float: available \$\{e\.available\}, required \$\{e\.required\}`, 409/,
  'origination 409 keeps its message and adds the funding payload');
assert.match(origination, /getAgentFunding\([\s\S]*excludeLoanId: loan\.id/, 'agent queue excludes the loan just filed');
for (const path of ['app/api/v1/approvals/[id]/approve/route.ts', 'app/(dashboard)/[module]/approvals/actions.ts']) {
  assert.match(read(path), /reportBlockedPendingLoan\(/, `${path} reports a MONEY-16 approval block with figures`);
}
for (const path of ['app/api/v1/wallet/release/route.ts', 'app/(dashboard)/[module]/wallet/actions.ts']) {
  assert.match(read(path), /notifyNewlyFundableLoans\(/, `${path} announces loans a release made payable`);
}
for (const path of ['app/api/v1/approvals/route.ts', 'app/(dashboard)/[module]/approvals/page.tsx']) {
  assert.match(read(path), /buildPendingLoanFunding\(/, `${path} sends server-computed funding`);
}
const lib = read('lib/loanFunding.ts');
assert.doesNotMatch(lib, /\$transaction/, 'alerts never run inside a money transaction (NOTIF-1, X-19)');

console.log('loan funding tests passed');
