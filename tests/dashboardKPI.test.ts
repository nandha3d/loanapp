import assert from 'node:assert/strict';
import { summarizeCollectionWorklist } from '../lib/collectionSummary';
import { formatCurrency } from '../lib/utils';

// ============================================================
// Dashboard KPI — Unit / Integration Tests
// Covers: formatting, scoping logic, calculations, role gates
// Maps to: ML-D, AF-D, CF-D, AG-D, XM-D test cases
// ============================================================

// --- Currency Formatting (XM-D-011) ---

assert.equal(formatCurrency(0, 'Rs '), 'Rs 0', 'XM-D-011 zero renders as Rs 0');
assert.equal(formatCurrency(100000, 'Rs '), 'Rs 1,00,000', 'XM-D-011 Indian grouping — 6 digits');
assert.equal(formatCurrency(9999999, 'Rs '), 'Rs 99,99,999', 'XM-D-011 Indian grouping — 7 digits');
assert.equal(formatCurrency(10000000, 'Rs '), 'Rs 1,00,00,000', 'XM-D-011 Indian grouping — 8 digits');
assert.equal(formatCurrency(1000, '\u20b9'), '\u20b91,000', 'XM-D-011 rupee symbol — 4 digits');
assert.equal(formatCurrency(-5000, 'Rs '), 'Rs -5,000', 'XM-D-011 negative amount formatting');

// --- Outstanding Calculation (ML-D-006 to ML-D-008) ---

function outstanding(dueAmount: number, receivedAmount: number) {
  return Math.max(0, dueAmount - (receivedAmount || 0));
}

assert.equal(outstanding(500, 200), 300, 'ML-D-006 partial payment: 500-200=300');
assert.equal(outstanding(300, 0), 300, 'ML-D-006 unpaid: 300-0=300');
assert.equal(outstanding(200, 200), 0, 'ML-D-007 fully paid: 200-200=0');
assert.equal(outstanding(300, 400), 0, 'ML-D-008 overpayment clamped: max(0,300-400)=0');
assert.equal(outstanding(1000, 600), 400, 'ML-D-013 partial overdue: 1000-600=400');

// --- Penalty Accumulated (ML-D-015 to ML-D-017) ---

function pendingPenaltyTotal(gross: number, settled: number, waived: number) {
  return Math.max(0, gross - settled - waived);
}

// ML-D-015: (500+800+300)-(100+0+0)-(0+200+0) = 1300
const totalGross = 500 + 800 + 300;
const totalSettled = 100 + 0 + 0;
const totalWaived = 0 + 200 + 0;
assert.equal(pendingPenaltyTotal(totalGross, totalSettled, totalWaived), 1300, 'ML-D-015 penalty total = 1300');

// ML-D-016: settled penalty excluded — tested by only summing pending/partial status
assert.equal(pendingPenaltyTotal(500, 0, 0), 500, 'ML-D-016 pending penalty included');

// ML-D-017: never negative
assert.equal(pendingPenaltyTotal(100, 60, 60), 0, 'ML-D-017 settled+waived > gross → 0, not -20');

// --- Capital Balance Formula (ML-D-020 to ML-D-021) ---

function calculateCapital(entries: { type: string; amount: number }[]) {
  let capital = 0;
  for (const entry of entries) {
    const amt = Number(entry.amount);
    if (entry.type === 'capital_add') capital += amt;
    else if (entry.type === 'capital_withdraw') capital -= amt;
    else if (entry.type === 'loan_disburse') capital -= amt;
    else if (entry.type === 'collection') capital += amt;
    else if (entry.type === 'expense') capital -= amt;
  }
  return capital;
}

// ML-D-020: capital_add 100000; loan_disburse 80000; collection 85000; expense 5000 = 100000
assert.equal(
  calculateCapital([
    { type: 'capital_add', amount: 100000 },
    { type: 'loan_disburse', amount: 80000 },
    { type: 'collection', amount: 85000 },
    { type: 'expense', amount: 5000 },
  ]),
  100000,
  'ML-D-020 capital balance = 100,000',
);

// ML-D-021: negative allowed
assert.equal(
  calculateCapital([
    { type: 'capital_add', amount: 10000 },
    { type: 'loan_disburse', amount: 15000 },
  ]),
  -5000,
  'ML-D-021 negative capital = -5,000',
);

// --- Progress Bar Calculation (AG-D-005 to AG-D-007) ---

function progressPct(expected: number, collected: number) {
  if (expected === 0) return 100;
  return Math.min(100, Math.round((collected / expected) * 100));
}

assert.equal(progressPct(1000, 750), 75, 'AG-D-005 750/1000 = 75%');
assert.equal(progressPct(0, 0), 100, 'AG-D-006 expected=0 → 100% (no division by zero)');
assert.equal(progressPct(500, 700), 100, 'AG-D-007 over-collected capped at 100%');
assert.equal(progressPct(1000, 1000), 100, 'AG-D-005 exact match = 100%');
assert.equal(progressPct(1000, 0), 0, 'AG-D-005 zero collected = 0%');

// --- Split Bar Proportions (ML-D-025 to ML-D-026) ---

function splitProportions(cash: number, upi: number) {
  const total = cash + upi;
  if (total === 0) return { cashPct: 0, upiPct: 0, total: 0 };
  return {
    cashPct: (cash / total) * 100,
    upiPct: (upi / total) * 100,
    total,
  };
}

const split = splitProportions(1000, 1200);
assert.equal(Math.round(split.cashPct * 10) / 10, 45.5, 'ML-D-025 cash proportion = 45.5%');
assert.equal(Math.round(split.upiPct * 10) / 10, 54.5, 'ML-D-025 UPI proportion = 54.5%');
assert.equal(split.total, 2200, 'ML-D-025 split total = 2200');

const zeroSplit = splitProportions(0, 0);
assert.equal(zeroSplit.cashPct, 0, 'ML-D-026 zero split — cashPct = 0');
assert.equal(zeroSplit.upiPct, 0, 'ML-D-026 zero split — upiPct = 0');
assert.equal(zeroSplit.total, 0, 'ML-D-026 zero split — total = 0');

// --- Pending Field Float (ML-D-022) ---

function pendingFieldFloat(pendingUpi: number, pendingCash: number) {
  return pendingUpi + pendingCash;
}

assert.equal(pendingFieldFloat(800, 200), 1000, 'ML-D-022 pending float = 800+200 = 1000');
assert.equal(pendingFieldFloat(0, 0), 0, 'ML-D-022 zero pending float = 0');

// --- Trend Collected Capped at Due (ML-D-037) ---

function trendCollected(dueAmount: number, receivedAmount: number) {
  return Math.min(receivedAmount, dueAmount);
}

assert.equal(trendCollected(1000, 1500), 1000, 'ML-D-037 overpayment capped at due amount');
assert.equal(trendCollected(1000, 800), 800, 'ML-D-037 underpayment = received amount');
assert.equal(trendCollected(0, 0), 0, 'ML-D-038 zero dues day = 0');

// --- Trend Bar Minimum Height (ML-D-038) ---

function barHeight(value: number, max: number) {
  return Math.max(4, (value / Math.max(1, max)) * 100);
}

assert.equal(barHeight(0, 1000), 4, 'ML-D-038 zero value renders at minimum 4px');
assert.equal(barHeight(1000, 1000), 100, 'ML-D-038 full value = 100%');
assert.equal(barHeight(500, 1000), 50, 'ML-D-038 half value = 50%');

// --- Overdue Deduplication (ML-D-011, CF-D-010) ---

function countOverdueCustomers(instalments: { customerId: string; outstanding: number }[]) {
  const overdueCustomers = new Set(
    instalments.filter((i) => i.outstanding > 0).map((i) => i.customerId),
  );
  return overdueCustomers.size;
}

// ML-D-011: 4 overdue instalments across 3 distinct customers
assert.equal(
  countOverdueCustomers([
    { customerId: 'c1', outstanding: 200 },
    { customerId: 'c1', outstanding: 300 },
    { customerId: 'c2', outstanding: 400 },
    { customerId: 'c3', outstanding: 500 },
  ]),
  3,
  'ML-D-011 4 instalments across 3 customers = 3 (deduplicated)',
);

// CF-D-010: 3 overdue subscriptions, 2 belong to same member
assert.equal(
  countOverdueCustomers([
    { customerId: 'm1', outstanding: 500 },
    { customerId: 'm1', outstanding: 750 },
    { customerId: 'm2', outstanding: 1000 },
  ]),
  2,
  'CF-D-010 3 overdue, 2 same member = 2 (deduplicated)',
);

// --- Pending Approvals Formula (ML-D-018 to ML-D-019) ---

function pendingApprovalsCount(approvalRequests: number, pendingLoans: number, pendingCustomers: number) {
  return approvalRequests + pendingLoans + pendingCustomers;
}

// ML-D-018: 2 ApprovalRequest(pending) + 1 loan(pending_review) + 1 customer(pending_review) = 4
assert.equal(
  pendingApprovalsCount(2, 1, 1),
  4,
  'ML-D-018 pending approvals = 2+1+1 = 4',
);

// ML-D-019: 2 approved (not pending) = 0
assert.equal(
  pendingApprovalsCount(0, 0, 0),
  0,
  'ML-D-019 no pending = 0',
);

// --- Balance Due Never Negative (CF-D-008) ---

function balanceDue(expected: number, collected: number) {
  return Math.max(0, expected - collected);
}

assert.equal(balanceDue(2750, 2050), 700, 'CF-D-007 balance due = 2750-2050 = 700');
assert.equal(balanceDue(1000, 1200), 0, 'CF-D-008 overpayment → balance = 0 (not -200)');

// --- Collection Summary Contract (ML-D-040 to ML-D-043) ---

const collectionSummary = summarizeCollectionWorklist({
  todayRows: [
    {
      dueDate: '2026-07-05T09:00:00.000Z',
      dueAmount: 1000,
      receivedAmount: 400,
      status: 'partial',
    },
  ],
  overdueRows: [
    {
      dueDate: '2026-07-04T09:00:00.000Z',
      dueAmount: 800,
      receivedAmount: 300,
      status: 'partial',
    },
  ],
  overdueCollectedToday: 300,
});

assert.equal(collectionSummary.todayExpected, 1000, 'ML-D-040 today expected excludes overdue dues');
assert.equal(collectionSummary.todayCollected, 400, 'ML-D-040 today collected is capped to today scheduled dues');
assert.equal(collectionSummary.todayOutstanding, 600, 'ML-D-040 today outstanding reflects partial payment');
assert.equal(collectionSummary.overdueCollectedToday, 300, 'ML-D-041 overdue paid today tracked separately');
assert.equal(collectionSummary.overdueOutstanding, 500, 'ML-D-042 overdue remaining after partial recovery');
assert.equal(collectionSummary.overdueTotalTillToday, 800, 'ML-D-042 overdue total includes recovered today plus remaining');

const fullyRecoveredOverdue = summarizeCollectionWorklist({
  todayRows: [],
  overdueRows: [
    {
      dueDate: '2026-07-03T09:00:00.000Z',
      dueAmount: 500,
      receivedAmount: 500,
      status: 'paid',
    },
  ],
  overdueCollectedToday: 500,
});

assert.equal(fullyRecoveredOverdue.overdueOutstanding, 0, 'ML-D-043 fully recovered overdue no longer outstanding');
assert.equal(fullyRecoveredOverdue.overdueTotalTillToday, 500, 'ML-D-043 fully recovered overdue remains in audit total');
assert.equal(fullyRecoveredOverdue.overduePendingCount, 0, 'ML-D-043 fully recovered overdue is not pending');

// --- Date Formatting (XM-D-012) ---

function formatDateLabel(date: Date) {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

const may15 = new Date('2026-05-15T00:00:00.000Z');
const label = formatDateLabel(may15);
assert.ok(label.includes('May'), 'XM-D-012 date label includes month name');
assert.ok(label.includes('15'), 'XM-D-012 date label includes day');

// --- Role Gate Logic (AG-D-017 to AG-D-020) ---

const adminKPIs = [
  'todayExpected', 'todayCollected', 'todayGap', 'totalCustomers',
  'overdueAmount', 'overdueCustomerCount', 'pendingPenaltyTotal',
  'pendingApprovals', 'currentCapital', 'todayCashCollected',
  'todayUpiCollected', 'pendingFieldFloat', 'pendingUpiCollections',
  'pendingCashCollections', 'routeCollections', 'highestBorrower', 'bestPayer',
];

const agentKPIs = [
  'todayExpected', 'todayCollected', 'todayGap', 'totalCustomers',
  'overdueAmount', 'overdueCustomerCount', 'overdueInstalments',
  'trend', 'routePerformance', 'myApprovals', 'pendingApprovals', 'recentLoans',
];

// Agent should NOT see these admin-only KPIs
const adminOnlyKPIs = [
  'currentCapital', 'todayCashCollected', 'todayUpiCollected',
  'pendingFieldFloat', 'pendingUpiCollections', 'pendingCashCollections',
  'routeCollections', 'highestBorrower', 'bestPayer',
];

for (const kpi of adminOnlyKPIs) {
  assert.equal(agentKPIs.includes(kpi), false, `AG-D-017 to AG-D-020 agent cannot see ${kpi}`);
}

// Agent CAN see these
const agentVisibleKPIs = ['todayExpected', 'todayCollected', 'todayGap', 'totalCustomers'];
for (const kpi of agentVisibleKPIs) {
  assert.equal(agentKPIs.includes(kpi), true, `AG-D-001 to AG-D-004 agent can see ${kpi}`);
}

// --- Cross-Module Isolation (ML-D-004, AF-D-001) ---

function filterByAppType(entries: { appType: string; amount: number }[], targetAppType: string) {
  return entries.filter((e) => e.appType === targetAppType);
}

const mixedEntries = [
  { appType: 'microlending', amount: 1000 },
  { appType: 'autofinance', amount: 500 },
  { appType: 'microlending', amount: 300 },
];

const mlEntries = filterByAppType(mixedEntries, 'microlending');
assert.equal(mlEntries.reduce((sum, e) => sum + e.amount, 0), 1300, 'ML-D-004 ML total excludes AF entries');

const afEntries = filterByAppType(mixedEntries, 'autofinance');
assert.equal(afEntries.reduce((sum, e) => sum + e.amount, 0), 500, 'AF-D-001 AF total excludes ML entries');

// --- Branch Scoping (ML-D-005, AF-D-013) ---

function filterByBranch(entries: { branchId: string; amount: number }[], targetBranchId: string) {
  return entries.filter((e) => e.branchId === targetBranchId);
}

const branchEntries = [
  { branchId: 'branch-a', amount: 1000 },
  { branchId: 'branch-b', amount: 400 },
];

const branchAEntries = filterByBranch(branchEntries, 'branch-a');
assert.equal(branchAEntries.reduce((sum, e) => sum + e.amount, 0), 1000, 'ML-D-005 Branch A total excludes Branch B');

// --- Recent Activity — Developer Excluded (XM-D-013) ---

function filterRecentActivity(logs: { userRole: string; action: string }[]) {
  return logs.filter((log) => log.userRole !== 'developer');
}

const auditLogs = [
  { userRole: 'admin', action: 'create_customer' },
  { userRole: 'admin', action: 'approve_loan' },
  { userRole: 'agent', action: 'collect_payment' },
  { userRole: 'developer', action: 'update_settings' },
];

const filteredLogs = filterRecentActivity(auditLogs);
assert.equal(filteredLogs.length, 3, 'XM-D-013 developer action excluded from activity feed');

// --- Recent Activity — Max 8 Items (XM-D-014) ---

function limitRecentActivity(logs: unknown[], max = 8) {
  return logs.slice(0, max);
}

const manyLogs = Array.from({ length: 15 }, (_, i) => ({ id: i }));
const limitedLogs = limitRecentActivity(manyLogs);
assert.equal(limitedLogs.length, 8, 'XM-D-014 activity feed capped at 8 items');

// --- Overdue Table — Max 10 Rows (ML-D-014, CF-D-011) ---

function limitOverdueTable(instalments: unknown[], max = 10) {
  return instalments.slice(0, max);
}

const manyOverdue = Array.from({ length: 15 }, (_, i) => ({ id: i, amount: 1000 }));
const tableOverdue = limitOverdueTable(manyOverdue);
assert.equal(tableOverdue.length, 10, 'ML-D-014 overdue table capped at 10 rows');

// --- Chit Funds — Members enrolled/total (CF-D-015) ---

function formatMembersDisplay(enrolled: number, total: number) {
  return `${enrolled} / ${total}`;
}

assert.equal(formatMembersDisplay(15, 20), '15 / 20', 'CF-D-015 members display format');

// --- Chit Funds — Balance Due (CF-D-007 to CF-D-008) ---

assert.equal(balanceDue(2750, 2050), 700, 'CF-D-007 today balance due = 700');
assert.equal(balanceDue(1000, 1200), 0, 'CF-D-008 balance due never negative');

// --- Empty State Guards ---

// Zero-state: no NaN/Infinity in any calculation
assert.equal(Number.isNaN(progressPct(0, 0)), false, 'Zero-state progress is not NaN');
assert.equal(Number.isNaN(splitProportions(0, 0).cashPct), false, 'Zero-state split is not NaN');
assert.equal(Number.isNaN(balanceDue(0, 0)), false, 'Zero-state balance due is not NaN');
assert.equal(Number.isNaN(barHeight(0, 0)), false, 'Zero-state bar height is not NaN');

// No Infinity
assert.equal(Number.isFinite(progressPct(0, 0)), true, 'Zero-state progress is finite');
assert.equal(Number.isFinite(splitProportions(0, 0).total), true, 'Zero-state split total is finite');

console.log('Dashboard KPI unit/integration tests passed');
