/**
 * Generates tests/e2e/microlending-testcases.xlsx — the full manual + automated
 * test-case matrix for the microlending workflow.
 *
 *   node scripts/gen-microlending-testcases.cjs
 *
 * One sheet per area + a Summary sheet. Columns are kept identical across sheets
 * so they can be filtered/concatenated in Excel.
 */
const path = require('path');
const XLSX = require('xlsx');

const COLS = [
  'ID',
  'Area',
  'Title',
  'Type',
  'Priority',
  'Preconditions',
  'Steps',
  'Test Data',
  'Expected Result',
  'Automated (spec)',
];

// area -> rows. Each row is an object keyed by COLS.
const D = {};
const add = (area, id, title, type, priority, pre, steps, data, expected, auto = '') => {
  (D[area] ??= []).push({
    ID: id, Area: area, Title: title, Type: type, Priority: priority,
    Preconditions: pre, Steps: steps, 'Test Data': data, 'Expected Result': expected,
    'Automated (spec)': auto,
  });
};

/* ─────────────── AUTH & ACCESS ─────────────── */
add('Auth & RBAC', 'AUTH-01', 'Login as superadmin', 'Positive', 'P1',
  'Seeded users', '1. Open /login 2. Enter superadmin/super123 3. Sign in',
  'superadmin / super123', 'Lands on dashboard; session cookie set', 'auth.setup.ts');
add('Auth & RBAC', 'AUTH-02', 'Login as admin', 'Positive', 'P1',
  'Seeded users', 'Login with admin/admin123', 'admin / admin123', 'Dashboard loads', 'auth.setup.ts');
add('Auth & RBAC', 'AUTH-03', 'Login as agent', 'Positive', 'P1',
  'Seeded users', 'Login with karthik/agent123', 'karthik / agent123', 'Agent home loads', 'auth.setup.ts');
add('Auth & RBAC', 'AUTH-04', 'Wrong password rejected', 'Negative', 'P2',
  '-', 'Login with valid user + wrong password', 'admin / wrong', 'Error shown; stays on /login', '');
add('Auth & RBAC', 'RBAC-01', 'Agent blocked from /loans', 'Security', 'P1',
  'Agent session', 'Navigate to /microlending/loans', '-', 'Redirected away from /loans', 'ML-R01');
add('Auth & RBAC', 'RBAC-02', 'Agent allowed on /collection', 'Positive', 'P1',
  'Agent session', 'Navigate to /microlending/collection', '-', 'Collection screen renders', 'ML-R02');
add('Auth & RBAC', 'RBAC-03', 'Agent allowed on /dashboard', 'Positive', 'P2',
  'Agent session', 'Open dashboard', '-', 'Dashboard renders (agent KPIs)', 'ML-R03');
add('Auth & RBAC', 'RBAC-04', 'Anonymous redirected to /login', 'Security', 'P1',
  'Logged out', 'Open /microlending/dashboard with no session', '-', 'Redirect to /login', '');

/* ─────────────── CUSTOMER ─────────────── */
add('Customer', 'CUST-01', 'Create customer (all required)', 'Positive', 'P1',
  'Route + agent exist', '1. /customers/new 2. Fill name, phone 3. Pick route + agent 4. Save',
  'name, 10-digit phone, route, agent', 'Customer created; profile page opens; appears in list', 'ML-01, ML-02');
add('Customer', 'CUST-02', 'Preferred collection time persists', 'Positive', 'P2',
  'Create form open', 'Select Preferred Collection Time = Morning; save; reopen edit',
  'morning', 'Value saved and shown on edit', 'ML-01');
add('Customer', 'CUST-03', 'Create with missing name rejected', 'Negative', 'P2',
  '-', 'Submit form with phone only', 'no name', 'HTML required blocks submit; stays on form', 'ML-N03');
add('Customer', 'CUST-04', 'Create with invalid phone', 'Negative', 'P2',
  '-', 'Enter non-10-digit phone; save', 'phone=123', 'Validation error / rejected', '');
add('Customer', 'CUST-05', 'Agent-created customer needs approval (no bypass)', 'Business', 'P1',
  'Agent without bypassCustomerApproval', 'Agent creates customer', '-', 'Customer status = pending_review', '');
add('Customer', 'CUST-06', 'Agent with bypassCustomerApproval → active', 'Business', 'P2',
  'Agent flag on', 'Agent creates customer', '-', 'Customer status = active immediately', '');
add('Customer', 'CUST-07', 'Admin-created customer is active (privilege kept)', 'Business', 'P1',
  'Admin session', 'Admin creates customer', '-', 'Status active (admin bypass unchanged)', '');
add('Customer', 'CUST-08', 'Customer location seeded for route', 'Data', 'P3',
  'npm run seed:locations run', 'Inspect customer lat/lng', '-', 'lat/lng set, clustered near route centre', '');
add('Customer', 'CUST-09', 'Edit customer updates fields', 'Positive', 'P2',
  'Customer exists', 'Open profile → edit → change address → save', '-', 'Updated value persists', '');

/* ─────────────── LOAN CREATION ─────────────── */
add('Loan', 'LOAN-01', 'Create daily loan (admin/superadmin → active)', 'Positive', 'P1',
  'Customer exists; branch float', '1. /loans/new 2. Pick customer 3. principal, tenure, frequency=daily, startDate=today 4. Create',
  'principal 10000, tenure 20, daily', 'Loan active; schedule of 20 instalments; outstanding = total payable', 'ML-03, ML-04');
add('Loan', 'LOAN-02', 'Weekly loan generates weekly-spaced instalments', 'Positive', 'P1',
  'Customer exists', 'Create loan frequency=weekly, tenure 10', 'weekly, dueDay set', 'Instalment dates 7 days apart', '');
add('Loan', 'LOAN-03', 'Monthly loan generates month-step dates', 'Positive', 'P2',
  'Customer exists', 'Create loan frequency=monthly, dueDay=10', 'monthly', 'Instalments on the 10th each month (clamped)', '');
add('Loan', 'LOAN-04', 'Biweekly loan = every 14 days', 'Positive', 'P2',
  'Customer exists', 'Create loan frequency=biweekly', 'biweekly', 'Instalment dates 14 days apart', '');
add('Loan', 'LOAN-05', 'principal = 0 rejected', 'Negative', 'P1',
  '-', 'Create loan with principal 0', 'principal 0', 'Rejected; stays on form', 'ML-N01, LOAN-01 OUT');
add('Loan', 'LOAN-06', 'No customer selected rejected', 'Negative', 'P1',
  '-', 'Create loan without customer', '-', 'Rejected; stays on form', 'ML-N02');
add('Loan', 'LOAN-07', 'Agent-created loan → pending_review', 'Business', 'P1',
  'Agent w/o bypassLoanApproval', 'Agent creates loan', '-', 'Loan pending_review; float NOT released until approval', '');
add('Loan', 'LOAN-08', 'Agent with autoReleaseFloat ON disburses on create', 'Business', 'P2',
  'Agent flag on', 'Agent creates loan', '-', 'Float released from agent on creation', '');
add('Loan', 'LOAN-09', 'Admin loan auto-releases float (privilege kept)', 'Regression', 'P1',
  'Admin session (default flags)', 'Admin creates loan', '-', 'Float disbursed from branch (NOT blocked by agent default)', '');
add('Loan', 'LOAN-10', 'totalPayable = principal + interest correct', 'Calc', 'P1',
  'Loan created', 'Inspect loan totals', '-', 'totalPayable matches calculator; perInstalment = payable/tenure', '');

/* ─────────────── APPROVAL ─────────────── */
add('Approval', 'APPR-01', 'Pending loan visible in approvals', 'Positive', 'P1',
  'Agent-created pending loan', 'Open /approvals as admin', '-', 'Loan listed pending', '');
add('Approval', 'APPR-02', 'Approve loan → active + float released', 'Positive', 'P1',
  'Pending loan; agent autoReleaseFloat on', 'Approve loan', '-', 'Status active; disburse posted', '');
add('Approval', 'APPR-03', 'Approve when creator autoReleaseFloat OFF → no disburse', 'Business', 'P2',
  'Agent flag off', 'Approve loan', '-', 'Status active but float NOT auto-released', '');
add('Approval', 'APPR-04', 'Reject loan', 'Positive', 'P2',
  'Pending loan', 'Reject with reason', '-', 'Status rejected; no disburse', '');
add('Approval', 'APPR-05', 'Pending customer approval flow', 'Positive', 'P2',
  'Pending customer', 'Approve customer', '-', 'Customer active', '');

/* ─────────────── SCHEDULE / FREQUENCY ─────────────── */
add('Schedule', 'SCH-01', 'Daily loan shows due today', 'Positive', 'P1',
  'Daily loan startDate today', 'Open collection', '-', 'Instalment #1 appears as due today', 'ML-07');
add('Schedule', 'SCH-02', 'Weekly loan NOT shown on non-cadence day', 'Business', 'P1',
  'Weekly loan, today not its weekday, not overdue', 'Open collection', '-', 'Customer not listed today', '');
add('Schedule', 'SCH-03', 'Weekly overdue surfaces only on its weekday', 'Business', 'P1',
  'Weekly loan overdue', 'Open collection on weekday vs non-weekday', '-', 'Listed on weekday; hidden between', '');
add('Schedule', 'SCH-04', 'Monthly overdue surfaces on its day-of-month', 'Business', 'P2',
  'Monthly loan overdue', 'Open collection on due day-of-month', '-', 'Listed on that date; hidden otherwise', '');
add('Schedule', 'SCH-05', 'Daily overdue shows every day', 'Business', 'P1',
  'Daily loan overdue', 'Open collection daily', '-', 'Listed every day until cleared', '');
add('Schedule', 'SCH-06', 'Overdue accumulates per cadence (not per day)', 'Calc', 'P1',
  'Weekly loan 3 weeks behind', 'Inspect Total Due', '-', 'Total = 3 × weekly amount, not 21 × daily', '');

/* ─────────────── COLLECTION (CORE LOGIC) ─────────────── */
add('Collection', 'COLL-01', 'Record today’s due (single instalment)', 'Positive', 'P1',
  'Due-today row', 'Pay → Today Due card → Submit', 'amount = today due', 'Entry recorded today; instalment paid', 'ML-07');
add('Collection', 'COLL-02', 'Pay Total Due spreads oldest-first', 'Positive', 'P1',
  'Overdue + today due', 'Pay → Total Due → Submit', 'amount = overdue+today', 'Each instalment filled to its due, oldest first; all dated today', '');
add('Collection', 'COLL-03', 'Partial payment fills oldest instalment(s) only', 'Positive', 'P1',
  'Overdue ≥ 2 instalments', 'Pay amount < total', 'partial', 'Oldest instalment(s) settled; remainder stays overdue', '');
add('Collection', 'COLL-04', 'Recorded on collection date (today), not due date', 'Business', 'P1',
  'Overdue rows', 'Pay overdue', '-', 'receivedAt/submittedAt = today; due dates unchanged', '');
add('Collection', 'COLL-05', 'Over-credit capped (no instalment > due)', 'Negative', 'P1',
  'Due row', 'Enter huge amount; submit', 'amount=99999999', 'Capped to outstanding; no instalment exceeds its due; no error', 'ML-N04');
add('Collection', 'COLL-06', 'Editable amount between presets', 'Positive', 'P2',
  'Popup open', 'Pick card then edit amount field', 'custom amount', 'Submitted amount = edited value', 'ML-05');
add('Collection', 'COLL-07', 'Paid customer stays visible (grayed) same day', 'Business', 'P1',
  'Customer fully paid today', 'Reopen collection list', '-', 'Row present, greyed; not removed', 'ML-08');
add('Collection', 'COLL-08', 'Large distribution does NOT time out', 'Performance', 'P1',
  'Loan w/ 20+ overdue instalments', 'Pay full total', '-', 'Completes < tx timeout; no "Transaction not found"', '');
add('Collection', 'COLL-09', 'Idempotent re-submit not double-counted', 'Negative', 'P1',
  'Just collected', 'Re-submit same amount same day', '-', 'No duplicate entry (idempotency key)', '');
add('Collection', 'COLL-10', 'UPI mode records without crediting agent cash float', 'Business', 'P2',
  'Due row', 'Pay with mode UPI', 'mode=upi', 'Entry recorded; cash float not credited for UPI', '');
add('Collection', 'COLL-11', 'Cash float credited to collecting agent', 'Business', 'P2',
  'Agent collects cash', 'Pay cash', 'mode=cash', 'Agent float += amount', '');
add('Collection', 'COLL-12', 'feeConfirmation forces pending_confirmation (agent only)', 'Business', 'P2',
  'Agent feeConfirmationMandatory ON', 'Agent collects cash', '-', 'verificationStatus=pending_confirmation', '');
add('Collection', 'COLL-13', 'Admin collecting NOT forced to confirm (privilege kept)', 'Regression', 'P2',
  'Admin collects cash', 'Admin collects', '-', 'verificationStatus stays pending (no force)', '');
add('Collection', 'COLL-14', 'Multi-loan customer: collect per loan (no cross-loan bleed)', 'Business', 'P1',
  'Customer w/ 2 loans', 'Collect on loan A', '-', 'Only loan A instalments affected', '');
add('Collection', 'COLL-15', 'Negative / zero amount rejected', 'Negative', 'P2',
  'Popup', 'Enter 0 or negative; submit', '0 / -100', 'Submit blocked / rejected', '');

/* ─────────────── LOAN DETAIL ─────────────── */
add('Loan Detail', 'LD-01', 'Schedule + outstanding render', 'Positive', 'P1',
  'Loan exists', 'Open loan detail', '-', 'Schedule table, outstanding, paid period shown', 'ML-04');
add('Loan Detail', 'LD-02', 'Record Payment popup = collection popup (2 cards)', 'Positive', 'P1',
  'Loan w/ outstanding', 'Click Record Payment', '-', 'Today Due + Total Due cards, editable amount', 'ML-05');
add('Loan Detail', 'LD-03', 'Actual view shows real per-instalment receipts', 'Business', 'P1',
  'Loan w/ payments', 'Toggle Actual', '-', 'Each instalment shows actual receivedAmount', 'ML-06');
add('Loan Detail', 'LD-04', 'Distributed view spreads total oldest-first', 'Business', 'P1',
  'Loan w/ payments', 'Toggle Distributed', '-', 'Total collected spread chronologically', 'ML-06');
add('Loan Detail', 'LD-05', 'Actual == Distributed after oldest-first collection', 'Regression', 'P1',
  'Collected via new flow', 'Compare both views', '-', 'Same instalments paid in both (no corruption)', 'ML-06');
add('Loan Detail', 'LD-06', 'Overdue rows are dull-red, no per-row Pay', 'UI', 'P1',
  'Loan w/ overdue', 'Open detail', '-', 'Missed rows red-tinted; only Edit (admin), no Pay/Pay link', '');
add('Loan Detail', 'LD-07', 'Today/upcoming rows keep Pay + Pay link', 'UI', 'P2',
  'Loan w/ today due', 'Open detail', '-', 'Pay opens popup; Pay link generates UPI link', '');
add('Loan Detail', 'LD-08', 'Admin Edit corrects a paid instalment', 'Positive', 'P2',
  'Paid instalment', 'Edit → change amount', '-', 'Correction recorded (capped to due)', '');
add('Loan Detail', 'LD-09', 'Calendar tracker reflects paid/missed', 'UI', 'P3',
  'Loan w/ history', 'Open detail', '-', 'Green=paid, red=missed cells match schedule', '');
add('Loan Detail', 'LD-10', 'Loan closes when all instalments paid', 'Business', 'P1',
  'Pay full outstanding', 'Collect remaining', '-', 'Loan status=closed; closedAt set', '');

/* ─────────────── PENALTY / CLOSE / RENEW ─────────────── */
add('Penalty/Close', 'PEN-01', 'Penalty accrues on overdue', 'Business', 'P2',
  'Overdue loan', 'Open penalty summary', '-', 'Pending penalty total shown', '');
add('Penalty/Close', 'PEN-02', 'Waive penalty', 'Positive', 'P2',
  'Penalty exists', 'Waive with amount', '-', 'Waived amount recorded; net reduces', '');
add('Penalty/Close', 'PEN-03', 'Settle penalty', 'Positive', 'P2',
  'Penalty exists', 'Settle with amount', '-', 'Settled amount recorded', '');
add('Penalty/Close', 'PEN-04', 'Preclose & settle', 'Business', 'P2',
  'Active loan', 'Preclose with payment ≥ outstanding', '-', 'Loan settled early', '');
add('Penalty/Close', 'PEN-05', 'Close loan (cheque-return guard)', 'Business', 'P2',
  'Loan w/ active cheque', 'Close without confirming cheque', '-', 'Blocked until cheque return confirmed', '');
add('Penalty/Close', 'PEN-06', 'Renew loan creates successor', 'Business', 'P3',
  'Closed/eligible loan', 'Renew', '-', 'New loan created; navigates to it', '');

/* ─────────────── DASHBOARD ─────────────── */
add('Dashboard', 'DSH-01', 'Today’s Split total = sum of modes (no >100%)', 'Regression', 'P1',
  'Collections today', 'Open dashboard', '-', 'Total = Σ modes; bar ≤ 100% (3111% bug gone)', 'ML-09');
add('Dashboard', 'DSH-02', 'Today activity feed lists collections', 'Positive', 'P2',
  'Collections today', 'Open dashboard', '-', 'One grouped line per collection: time, customer, agent, amount', 'ML-10');
add('Dashboard', 'DSH-03', 'Distributed payment = ONE activity line (not N)', 'Business', 'P2',
  'Spread payment across N instalments', 'Open activity feed', '-', 'Single line, amount = total, "N inst." hint', '');
add('Dashboard', 'DSH-04', 'Today Collected vs Today Expected consistent', 'Calc', 'P1',
  'Collections today', 'Inspect KPIs', '-', 'collected + remaining = expected (today instalments)', '');
add('Dashboard', 'DSH-05', 'Overdue KPI totals reflect true overdue', 'Calc', 'P2',
  'Overdue loans', 'Inspect overdue card', '-', 'Totals independent of frequency-aware list filter', '');
add('Dashboard', 'DSH-06', 'Pending field float = pending cash + UPI', 'Calc', 'P3',
  'Pending handover/verify', 'Inspect capital card', '-', 'Float = pending cash + pending UPI', '');

/* ─────────────── PERMISSIONS (AGENT-ONLY) ─────────────── */
add('Permissions', 'PRM-01', 'Permission toggles shown only for agent role', 'Business', 'P1',
  'Admin user mgmt', 'Open user form; switch role agent↔admin', '-', 'Toggles appear only when role=agent', '');
add('Permissions', 'PRM-02', 'Toggles ignored for non-agent in logic', 'Regression', 'P1',
  'Admin user', 'Create loan/collect as admin', '-', 'autoRelease/feeConfirmation NOT applied to admin', 'LOAN-09, COLL-13');
add('Permissions', 'PRM-03', 'bypassLoanApproval lets agent create active loan', 'Business', 'P2',
  'Agent flag on', 'Agent creates loan', '-', 'Loan active immediately', '');
add('Permissions', 'PRM-04', 'bypassCustomerApproval lets agent create active customer', 'Business', 'P2',
  'Agent flag on', 'Agent creates customer', '-', 'Customer active immediately', '');

const wb = XLSX.utils.book_new();

// Summary sheet first.
const summaryRows = Object.entries(D).map(([area, rows]) => ({
  Area: area,
  'Total Cases': rows.length,
  P1: rows.filter((r) => r.Priority === 'P1').length,
  Automated: rows.filter((r) => r['Automated (spec)']).length,
}));
const totalCases = Object.values(D).reduce((n, r) => n + r.length, 0);
summaryRows.push({ Area: 'TOTAL', 'Total Cases': totalCases, P1: '', Automated: '' });
const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
summaryWs['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 6 }, { wch: 10 }];
XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

// One sheet per area.
for (const [area, rows] of Object.entries(D)) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: COLS });
  ws['!cols'] = [
    { wch: 10 }, { wch: 16 }, { wch: 42 }, { wch: 12 }, { wch: 8 },
    { wch: 30 }, { wch: 50 }, { wch: 22 }, { wch: 52 }, { wch: 18 },
  ];
  // Excel sheet names: max 31 chars, no special chars.
  const name = area.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, name);
}

// Combined "All Cases" sheet.
const all = Object.values(D).flat();
const allWs = XLSX.utils.json_to_sheet(all, { header: COLS });
allWs['!cols'] = [
  { wch: 10 }, { wch: 16 }, { wch: 42 }, { wch: 12 }, { wch: 8 },
  { wch: 30 }, { wch: 50 }, { wch: 22 }, { wch: 52 }, { wch: 18 },
];
XLSX.utils.book_append_sheet(wb, allWs, 'All Cases');

const out = path.join(__dirname, '..', 'tests', 'e2e', 'microlending-testcases.xlsx');
XLSX.writeFile(wb, out);
console.log(`Wrote ${all.length} test cases across ${Object.keys(D).length} areas → ${out}`);
