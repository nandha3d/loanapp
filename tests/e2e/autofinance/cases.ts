/**
 * Auto Finance — master test-case catalogue.
 *
 * Single source of truth for both the Playwright specs and the HTML tracker,
 * mirroring tests/e2e/microlending/cases.ts and tests/e2e/chitfunds/cases.ts.
 * A spec claims a case by putting its id in the test title: `test('[AUTO-101] …')`.
 *
 * The id prefix is AUTO- rather than AF- on purpose: `AF-1`…`AF-5` are the
 * numbered RULES in ENGINEERING_REFERENCE §10.7, and a case id that reads like
 * a rule id makes every failure message ambiguous.
 *
 * Reference HP quote used throughout, worked by hand from lib/autofinance/hp.ts:
 *
 *   vehicleValue 500000, downPayment 100000, rate 12%, flat, 24 months
 *     principal      = 500000 − 100000            = 400000
 *     totalInterest  = 400000 × 12% × (24/12)     =  96000
 *     totalPayable   = 400000 + 96000             = 496000
 *     emi            = 496000 / 24                = 20666.67   (round2)
 *     principal/month= 400000 / 24                = 16666.67
 *     interest/month =  96000 / 24                =   4000
 *
 *   with charges: insurance 5000 + document 2000 + broker 3000 = 10000
 *     grossPayout    = 400000        recoveredCharges = 10000
 *     netPayout      = 390000        ← what the office actually hands over
 */

export type Automation = 'auto' | 'manual';
export type Priority = 'P0' | 'P1' | 'P2';

export type AutoCase = {
  id: string;
  area: string;
  title: string;
  priority: Priority;
  automation: Automation;
  rules?: string[];
  pre?: string;
  steps: string[];
  expected: string[];
};

export const AREAS = [
  'Module Access & Gating',
  'Vehicle Registry',
  'Vehicle Approval & Agent Bypass',
  'HP Quote — Flat',
  'HP Quote — Diminishing',
  'HP Quote — Validation',
  'Payout, Charges & Legs',
  'Due Dates & Schedule',
  'HP Origination',
  'Finance Partners',
  'Hand-Loan & Charges',
  'EMI Collection — Waterfall',
  'Settlement & Closure',
  'Due Chart & Ledger',
  'Vehicle Seizure & Release',
  'Pending Tasks Queue',
  'Login Window',
  'Day Closing',
  'Accounting & Float',
  'Penalties & NPA',
  'Branch & Tenant Isolation',
  'RBAC',
  'Dashboard & Reports',
  'Notifications & Approvals',
  'Security & Negative',
  'Concurrency & Performance',
] as const;

export const CASES: AutoCase[] = [
  // ───────────────────── A. Module Access & Gating ─────────────────────
  {
    id: 'AUTO-001', area: 'Module Access & Gating', priority: 'P0', automation: 'auto',
    title: 'Registering with autofinance selected entitles the tenant to the module',
    rules: ['SCOPE-4'],
    steps: ['Register a tenant with selectedModules ["autofinance"]'],
    expected: ['Tenant, owner and Head Office branch created', 'The subscription snapshot carries autofinance'],
  },
  {
    id: 'AUTO-002', area: 'Module Access & Gating', priority: 'P0', automation: 'auto',
    title: 'Auto Finance pages load for an entitled tenant',
    rules: ['SCOPE-4'],
    steps: ['Log in as the owner', 'Open /autofinance/vehicles'],
    expected: ['The vehicle registry renders', 'No redirect to /portal or /dashboard'],
  },
  {
    id: 'AUTO-003', area: 'Module Access & Gating', priority: 'P0', automation: 'auto',
    title: 'A tenant without the module is refused the vehicle pages',
    rules: ['SCOPE-4'],
    steps: ['As a tenant without autofinance, open /autofinance/vehicles'],
    expected: ['requireModule refuses', 'No vehicle row from any tenant is rendered'],
  },
  {
    id: 'AUTO-004', area: 'Module Access & Gating', priority: 'P0', automation: 'auto',
    title: 'The vehicles API refuses a tenant without the module',
    rules: ['SCOPE-4', 'ROLE-4'],
    steps: ['GET /api/v1/vehicles with a token from a tenant that has no autofinance'],
    expected: ['Non-2xx, or an empty list', 'Never another tenant’s registry'],
  },
  {
    id: 'AUTO-005', area: 'Module Access & Gating', priority: 'P1', automation: 'auto',
    title: 'Vehicles are stamped with appType autofinance',
    rules: ['SCOPE-1'],
    steps: ['Create a vehicle and read the row'],
    expected: ['appType is autofinance', 'The row never appears under a microlending query'],
  },
  {
    id: 'AUTO-006', area: 'Module Access & Gating', priority: 'P1', automation: 'auto',
    title: 'The module-exclusive pages are reachable only under their module prefix',
    rules: ['SCOPE-4'],
    steps: ['Open /vehicles with no module prefix', 'Open /autofinance/vehicles'],
    expected: ['The bare path resolves to the autofinance module rather than 404ing', 'Both land on the same registry'],
  },
  {
    id: 'AUTO-007', area: 'Module Access & Gating', priority: 'P2', automation: 'auto',
    title: 'Every vehicle endpoint refuses an unauthenticated caller',
    rules: ['ROLE-4', 'X-13'],
    steps: ['Call the vehicle list, detail and create routes with no token'],
    expected: ['HTTP 401 on each', 'No registration number or customer name in any body'],
  },
  {
    id: 'AUTO-008', area: 'Module Access & Gating', priority: 'P2', automation: 'manual',
    title: 'Auto Finance navigation shows the module-exclusive entries',
    steps: ['Log in as an admin on the autofinance module'],
    expected: ['Vehicles, Finance Partners and Pending Tasks are present', 'They are absent under micro-lending'],
  },

  // ───────────────────────── B. Vehicle Registry ─────────────────────────
  {
    id: 'AUTO-020', area: 'Vehicle Registry', priority: 'P0', automation: 'auto',
    title: 'A vehicle is created with the minimum valid payload',
    steps: ['POST /api/v1/vehicles with customerId, registrationNo, make and model'],
    expected: ['HTTP 2xx', 'The row carries the tenant, the appType and the customer', 'status active for an admin'],
  },
  {
    id: 'AUTO-021', area: 'Vehicle Registry', priority: 'P0', automation: 'auto',
    title: 'customerId, registrationNo, make and model are all required',
    rules: ['API-4'],
    steps: ['POST with each of the four fields omitted in turn'],
    expected: ['HTTP 400 each time naming the missing fields', 'No row created'],
  },
  {
    id: 'AUTO-022', area: 'Vehicle Registry', priority: 'P0', automation: 'auto',
    title: 'A duplicate registration number is refused',
    rules: ['AF-4'],
    steps: ['Create TN39AB1234', 'Create it again'],
    expected: ['HTTP 409 quoting the registration', 'Exactly one vehicle row exists'],
  },
  {
    id: 'AUTO-023', area: 'Vehicle Registry', priority: 'P0', automation: 'auto',
    title: 'A registration number is normalised to trimmed uppercase before it is stored',
    rules: ['AF-4'],
    pre: 'The origination path normalises with .trim().toUpperCase(); the standalone registry route only trims',
    steps: ['POST a vehicle with registrationNo "  tn39ab1234  "'],
    expected: ['The stored value is exactly "TN39AB1234"', 'Whitespace and case never reach the row'],
  },
  {
    id: 'AUTO-024', area: 'Vehicle Registry', priority: 'P0', automation: 'auto',
    title: 'A case variant of an existing registration is treated as the same vehicle',
    rules: ['AF-4'],
    steps: ['Create "TN39AB1234"', 'Create "tn39ab1234"'],
    expected: ['The second is refused with a clean 409, not a database constraint error', 'One registry row, one physical vehicle'],
  },
  {
    id: 'AUTO-025', area: 'Vehicle Registry', priority: 'P1', automation: 'auto',
    title: 'The same registration may exist in a different tenant',
    rules: ['AF-4', 'SCOPE-1'],
    steps: ['Create TN39AB1234 in tenant A', 'Create TN39AB1234 in tenant B'],
    expected: ['Both succeed — the uniqueness is per (tenantId, appType)'],
  },
  {
    id: 'AUTO-026', area: 'Vehicle Registry', priority: 'P1', automation: 'auto',
    title: 'A soft-deleted vehicle frees its registration number',
    rules: ['AF-4', 'DB-4'],
    steps: ['Create TN39AB1234, soft-delete it, create it again'],
    expected: ['The re-registration is allowed', 'The deleted row stays in the table with its deletedAt'],
  },
  {
    id: 'AUTO-027', area: 'Vehicle Registry', priority: 'P1', automation: 'auto',
    title: 'A vehicle cannot be filed against another tenant’s customer',
    rules: ['SCOPE-1', 'API-5'],
    steps: ['POST with a customerId from tenant B'],
    expected: ['HTTP 404 "Customer not found" — existence is not confirmed'],
  },
  {
    id: 'AUTO-028', area: 'Vehicle Registry', priority: 'P1', automation: 'auto',
    title: 'An agent may only file a vehicle against a customer they hold',
    rules: ['SCOPE-3', 'ROLE-4'],
    steps: ['As agent A1 POST a vehicle for a customer on another agent’s route'],
    expected: ['HTTP 404', 'The agent’s own customer succeeds'],
  },
  {
    id: 'AUTO-029', area: 'Vehicle Registry', priority: 'P1', automation: 'auto',
    title: 'The registry list is branch-scoped',
    rules: ['SCOPE-3'],
    steps: ['List vehicles as an HQ admin with an Erode vehicle present'],
    expected: ['Only HQ vehicles', 'A superadmin across branches sees both'],
  },
  {
    id: 'AUTO-030', area: 'Vehicle Registry', priority: 'P1', automation: 'auto',
    title: 'An agent sees only vehicles of customers they hold',
    rules: ['SCOPE-3'],
    steps: ['List vehicles as agent A1'],
    expected: ['Only vehicles of A1’s customers', 'No vehicle from another agent’s book'],
  },
  {
    id: 'AUTO-031', area: 'Vehicle Registry', priority: 'P2', automation: 'auto',
    title: 'Partial registration search finds the vehicle',
    steps: ['Search the list with "39AB"'],
    expected: ['TN39AB1234 is returned', 'The search is what field staff actually type — a fragment, not the whole plate'],
  },
  {
    id: 'AUTO-032', area: 'Vehicle Registry', priority: 'P1', automation: 'auto',
    title: 'A vehicle update changes only the fields supplied',
    steps: ['PATCH the colour only'],
    expected: ['Colour updated, make and model untouched', 'An empty patch is refused with "No changes"'],
  },
  {
    id: 'AUTO-033', area: 'Vehicle Registry', priority: 'P1', automation: 'auto',
    title: 'A vehicle from another branch cannot be patched',
    rules: ['SCOPE-3'],
    steps: ['PATCH the Erode vehicle while HQ is active'],
    expected: ['HTTP 404'],
  },
  {
    id: 'AUTO-034', area: 'Vehicle Registry', priority: 'P2', automation: 'auto',
    title: 'Engine and chassis numbers are stored as entered',
    steps: ['Create with an engine and chassis number'],
    expected: ['Both persist verbatim', 'Neither is silently uppercased into a different value than shown'],
  },
  {
    id: 'AUTO-035', area: 'Vehicle Registry', priority: 'P2', automation: 'auto',
    title: 'An insurance expiry in the past is accepted but flagged',
    steps: ['Create with an insuranceExpiry of last month'],
    expected: ['Stored', 'The vehicle reads as expired-insurance wherever that is surfaced'],
  },
  {
    id: 'AUTO-036', area: 'Vehicle Registry', priority: 'P2', automation: 'auto',
    title: 'vehicleType defaults to two_wheeler and accepts the known set',
    steps: ['Create without a vehicleType', 'Create with each supported type'],
    expected: ['The default is two_wheeler', 'An unknown type is refused rather than stored raw'],
  },
  {
    id: 'AUTO-037', area: 'Vehicle Registry', priority: 'P2', automation: 'manual',
    title: 'The vehicle form is usable on a 360px viewport',
    steps: ['Open the new-vehicle form at 360x740 and submit'],
    expected: ['No horizontal scroll, no clipped field', 'Validation errors appear against their own fields'],
  },

  // ────────────── C. Vehicle Approval & Agent Bypass ──────────────
  {
    id: 'AUTO-050', area: 'Vehicle Approval & Agent Bypass', priority: 'P0', automation: 'auto',
    title: 'An agent’s vehicle lands in pending_review',
    rules: ['ROLE-5'],
    steps: ['As agent A1 (bypassVehicleApproval false) create a vehicle'],
    expected: ['status pending_review', 'An approval notification reaches the branch admins'],
  },
  {
    id: 'AUTO-051', area: 'Vehicle Approval & Agent Bypass', priority: 'P0', automation: 'auto',
    title: 'An agent holding the bypass creates an active vehicle',
    rules: ['ROLE-5'],
    steps: ['Set bypassVehicleApproval on A1', 'Create a vehicle'],
    expected: ['status active', 'No approval request is raised'],
  },
  {
    id: 'AUTO-052', area: 'Vehicle Approval & Agent Bypass', priority: 'P1', automation: 'auto',
    title: 'An admin’s vehicle is active without review',
    rules: ['ROLE-5'],
    steps: ['As a branch admin create a vehicle'],
    expected: ['status active', 'The agent-only flag never gates a non-agent'],
  },
  {
    id: 'AUTO-053', area: 'Vehicle Approval & Agent Bypass', priority: 'P1', automation: 'auto',
    title: 'A pending vehicle cannot be financed until it is approved',
    steps: ['Originate an HP loan against a pending_review vehicle'],
    expected: ['Refused, or the loan is itself held for approval', 'An unreviewed asset never silently becomes collateral'],
  },
  {
    id: 'AUTO-054', area: 'Vehicle Approval & Agent Bypass', priority: 'P1', automation: 'auto',
    title: 'Approving a pending vehicle activates it and clears the queue',
    steps: ['Approve the pending vehicle as an admin'],
    expected: ['status active', 'It leaves the pending queue', 'The approval is audited with its actor'],
  },
  {
    id: 'AUTO-055', area: 'Vehicle Approval & Agent Bypass', priority: 'P1', automation: 'auto',
    title: 'Rejecting a pending vehicle records the reason',
    steps: ['Reject with a reason'],
    expected: ['The reason is stored and shown to the submitting agent', 'The row is not deleted'],
  },
  {
    id: 'AUTO-056', area: 'Vehicle Approval & Agent Bypass', priority: 'P1', automation: 'auto',
    title: 'An agent cannot approve their own vehicle',
    rules: ['ROLE-4'],
    steps: ['As A1 approve the vehicle A1 submitted'],
    expected: ['HTTP 403', 'status stays pending_review'],
  },
  {
    id: 'AUTO-057', area: 'Vehicle Approval & Agent Bypass', priority: 'P2', automation: 'auto',
    title: 'The approval queue is branch-scoped',
    rules: ['SCOPE-3'],
    steps: ['Read the pending-vehicle queue as an HQ admin with an Erode submission outstanding'],
    expected: ['Only HQ submissions are listed'],
  },

  // ───────────────────────── D. HP Quote — Flat ─────────────────────────
  {
    id: 'AUTO-070', area: 'HP Quote — Flat', priority: 'P0', automation: 'auto',
    title: 'The reference flat quote produces the worked figures',
    rules: ['AF-1'],
    steps: ['Quote vehicleValue 500000, downPayment 100000, rate 12, flat, 24 months'],
    expected: ['principal 400000', 'totalInterest 96000', 'totalPayable 496000', 'emi 20666.67'],
  },
  {
    id: 'AUTO-071', area: 'HP Quote — Flat', priority: 'P0', automation: 'auto',
    title: 'Flat interest is charged on the whole principal for the whole tenure',
    rules: ['AF-1'],
    steps: ['Quote the reference at 12 months, then at 24, then at 36'],
    expected: ['Interest scales linearly with the tenure: 48000, 96000, 144000', 'It never reduces with the balance — that is what flat means'],
  },
  {
    id: 'AUTO-072', area: 'HP Quote — Flat', priority: 'P0', automation: 'auto',
    title: 'Every flat instalment carries the same principal and interest split',
    rules: ['AF-1'],
    steps: ['Read the reference schedule'],
    expected: ['principalComponent 16666.67 on every row', 'interestComponent 4000 on every row', 'Only the final row differs, and only by the rounding remainder'],
  },
  {
    id: 'AUTO-073', area: 'HP Quote — Flat', priority: 'P0', automation: 'auto',
    title: 'The schedule sums exactly to totalPayable',
    rules: ['DB-13'],
    steps: ['Sum dueAmount across the 24 reference rows'],
    expected: ['The sum is exactly 496000', 'The −0.08 rounding drift lands on the final instalment, not spread across the schedule'],
  },
  {
    id: 'AUTO-074', area: 'HP Quote — Flat', priority: 'P1', automation: 'auto',
    title: 'roundOffEmi changes what the customer actually repays',
    rules: ['AF-1'],
    steps: ['Quote the reference with roundOffEmi true'],
    expected: ['emi 20667', 'totalPayable restated to 496008', 'totalInterest restated to 96008 — the rounding is charged, not absorbed'],
  },
  {
    id: 'AUTO-075', area: 'HP Quote — Flat', priority: 'P1', automation: 'auto',
    title: 'A rounded schedule still sums to its own totalPayable',
    rules: ['DB-13'],
    steps: ['Sum the rounded reference schedule'],
    expected: ['24 × 20667 = 496008 exactly', 'No residue on the final row'],
  },
  {
    id: 'AUTO-076', area: 'HP Quote — Flat', priority: 'P1', automation: 'auto',
    title: 'The running balance reaches zero on the final instalment',
    steps: ['Read the balance column of the reference schedule'],
    expected: ['Balance falls monotonically', 'The last row leaves 0, never a negative or a stranded remainder'],
  },
  {
    id: 'AUTO-077', area: 'HP Quote — Flat', priority: 'P1', automation: 'auto',
    title: 'A single-instalment flat contract is one payment of principal plus one month of interest',
    steps: ['Quote the reference at tenure 1'],
    expected: ['interest 4000', 'emi 404000', 'One schedule row'],
  },
  {
    id: 'AUTO-078', area: 'HP Quote — Flat', priority: 'P1', automation: 'auto',
    title: 'A zero-rate flat contract repays only the principal',
    steps: ['Quote the reference at rate 0'],
    expected: ['totalInterest 0', 'totalPayable 400000', 'emi 16666.67'],
  },
  {
    id: 'AUTO-079', area: 'HP Quote — Flat', priority: 'P1', automation: 'auto',
    title: 'An additional financed amount is inside the principal, not beside it',
    rules: ['AF-1'],
    steps: ['Quote the reference with handLoanAmount 50000'],
    expected: ['principal 450000', 'Interest is charged on 450000, because the advance is financed under the same contract'],
  },
  {
    id: 'AUTO-080', area: 'HP Quote — Flat', priority: 'P2', automation: 'auto',
    title: 'A fractional vehicle value survives the quote without drift',
    rules: ['DB-13'],
    steps: ['Quote vehicleValue 499999.99 with downPayment 99999.99'],
    expected: ['principal is exactly 400000', 'No floating-point residue in the stored figures'],
  },
  {
    id: 'AUTO-081', area: 'HP Quote — Flat', priority: 'P2', automation: 'auto',
    title: 'A long tenure does not degrade the totals',
    steps: ['Quote the reference at 84 months'],
    expected: ['84 schedule rows', 'The sum still equals totalPayable exactly'],
  },

  // ────────────────────── E. HP Quote — Diminishing ──────────────────────
  {
    id: 'AUTO-095', area: 'HP Quote — Diminishing', priority: 'P0', automation: 'auto',
    title: 'The first interest component is one month of interest on the full principal',
    rules: ['AF-1'],
    steps: ['Quote the reference as diminishing at 12%'],
    expected: ['Row 1 interestComponent is exactly 4000 (400000 × 1%)', 'Every later row is smaller than the one before'],
  },
  {
    id: 'AUTO-096', area: 'HP Quote — Diminishing', priority: 'P0', automation: 'auto',
    title: 'Diminishing interest is materially less than flat at the same rate',
    rules: ['AF-1'],
    steps: ['Quote the reference both ways at 12% over 24 months'],
    expected: ['The diminishing total interest is well under the flat 96000', 'The two are never presented as interchangeable'],
  },
  {
    id: 'AUTO-097', area: 'HP Quote — Diminishing', priority: 'P0', automation: 'auto',
    title: 'The principal components sum to the principal',
    rules: ['DB-13'],
    steps: ['Sum principalComponent across the diminishing schedule'],
    expected: ['Exactly 400000', 'The final row clears whatever principal is left rather than repeating the EMI'],
  },
  {
    id: 'AUTO-098', area: 'HP Quote — Diminishing', priority: 'P0', automation: 'auto',
    title: 'The final balance is zero',
    steps: ['Read the last row of the diminishing schedule'],
    expected: ['balance 0', 'dueAmount equals its own principal plus interest, which may differ from the headline EMI'],
  },
  {
    id: 'AUTO-099', area: 'HP Quote — Diminishing', priority: 'P1', automation: 'auto',
    title: 'totalInterest is derived from the schedule, not quoted separately',
    rules: ['AF-1'],
    steps: ['Compare totalInterest against the summed interest components'],
    expected: ['They agree to the paisa', 'totalPayable equals the summed dues'],
  },
  {
    id: 'AUTO-100', area: 'HP Quote — Diminishing', priority: 'P1', automation: 'auto',
    title: 'A zero-rate diminishing contract degenerates to equal principal instalments',
    steps: ['Quote diminishing at rate 0'],
    expected: ['emi 16666.67', 'Every interestComponent is 0', 'No division by zero in the annuity factor'],
  },
  {
    id: 'AUTO-101', area: 'HP Quote — Diminishing', priority: 'P1', automation: 'auto',
    title: 'A single-instalment diminishing contract matches the flat single instalment',
    steps: ['Quote diminishing at tenure 1, rate 12'],
    expected: ['One row of 404000', 'The annuity does not blow up at n = 1'],
  },
  {
    id: 'AUTO-102', area: 'HP Quote — Diminishing', priority: 'P1', automation: 'auto',
    title: 'roundOffEmi rounds the annuity and the last row absorbs the difference',
    steps: ['Quote diminishing with roundOffEmi true'],
    expected: ['emi is a whole rupee', 'The schedule still sums to totalPayable', 'The final row carries the adjustment'],
  },
  {
    id: 'AUTO-103', area: 'HP Quote — Diminishing', priority: 'P2', automation: 'auto',
    title: 'A very high rate still produces a payable schedule',
    steps: ['Quote diminishing at 48%'],
    expected: ['Every dueAmount is positive', 'The principal still amortises to zero — the EMI never falls below the monthly interest'],
  },
  {
    id: 'AUTO-104', area: 'HP Quote — Diminishing', priority: 'P2', automation: 'auto',
    title: 'The interest component never exceeds the instalment',
    steps: ['Scan the diminishing schedule'],
    expected: ['principalComponent is non-negative on every row', 'A contract that can never amortise is refused rather than scheduled'],
  },

  // ────────────────────── F. HP Quote — Validation ──────────────────────
  {
    id: 'AUTO-120', area: 'HP Quote — Validation', priority: 'P0', automation: 'auto',
    title: 'A zero or negative vehicle value is refused',
    rules: ['AF-1', 'API-4'],
    steps: ['Quote with vehicleValue 0, then −1'],
    expected: ['Refused with "Vehicle value must be greater than zero."', 'HTTP 400 through the origination route, never a 500'],
  },
  {
    id: 'AUTO-121', area: 'HP Quote — Validation', priority: 'P0', automation: 'auto',
    title: 'A negative down payment is refused',
    steps: ['Quote with downPayment −1000'],
    expected: ['Refused with "Down payment cannot be negative."'],
  },
  {
    id: 'AUTO-122', area: 'HP Quote — Validation', priority: 'P0', automation: 'auto',
    title: 'A down payment at or above the vehicle value is refused',
    steps: ['Quote with downPayment equal to the vehicle value, then above it'],
    expected: ['Both refused with "Down payment must be less than the vehicle value."', 'A zero or negative principal is never scheduled'],
  },
  {
    id: 'AUTO-123', area: 'HP Quote — Validation', priority: 'P0', automation: 'auto',
    title: 'A negative rate is refused',
    steps: ['Quote with interestRate −5'],
    expected: ['Refused with "Interest rate cannot be negative."'],
  },
  {
    id: 'AUTO-124', area: 'HP Quote — Validation', priority: 'P0', automation: 'auto',
    title: 'Tenure must be a positive whole number of months',
    rules: ['AF-2'],
    steps: ['Quote with tenure 0, then −6, then 12.5'],
    expected: ['All three refused with the whole-number message', 'A fractional tenure never reaches the schedule builder'],
  },
  {
    id: 'AUTO-125', area: 'HP Quote — Validation', priority: 'P1', automation: 'auto',
    title: 'A negative charge is refused by name',
    steps: ['Quote with insuranceCharge −1, then documentCharge −1, then brokerCommission −1'],
    expected: ['Each refusal names the offending charge', 'The operator is told which figure to fix'],
  },
  {
    id: 'AUTO-126', area: 'HP Quote — Validation', priority: 'P1', automation: 'auto',
    title: 'A negative hand-loan amount is refused',
    steps: ['Quote with handLoanAmount −5000'],
    expected: ['Refused with "Hand-loan amount cannot be negative."'],
  },
  {
    id: 'AUTO-127', area: 'HP Quote — Validation', priority: 'P1', automation: 'auto',
    title: 'A non-numeric money field is refused, not coerced to zero',
    rules: ['API-4'],
    steps: ['Quote with vehicleValue "five lakh"'],
    expected: ['Refused', 'Never quietly treated as 0 and scheduled'],
  },
  {
    id: 'AUTO-128', area: 'HP Quote — Validation', priority: 'P0', automation: 'auto',
    title: 'Client-claimed principal, EMI or total payable are ignored',
    rules: ['AF-1'],
    steps: ['POST an HP origination with principal, perInstalment and totalPayable set to values that flatter the customer'],
    expected: ['The persisted loan carries the figures buildHpOriginationTerms computed', 'The claimed values are not read'],
  },
  {
    id: 'AUTO-129', area: 'HP Quote — Validation', priority: 'P1', automation: 'auto',
    title: 'Every quote refusal surfaces as a 400 through the API',
    rules: ['API-4'],
    steps: ['Send each invalid quote through /api/v1/loans with an autoFinance body'],
    expected: ['HTTP 400 with the validator’s own message', 'Never a 500 — the caller typed something wrong, the server did not fall over'],
  },

  // ────────────────── G. Payout, Charges & Legs ──────────────────
  {
    id: 'AUTO-145', area: 'Payout, Charges & Legs', priority: 'P0', automation: 'auto',
    title: 'Charges are recovered from the payout, not added to it',
    rules: ['AF-1'],
    steps: ['Quote the reference with insurance 5000, document 2000, broker 3000'],
    expected: ['grossPayout 400000', 'recoveredCharges 10000', 'netPayout 390000 — the borrower receives less, they do not owe more'],
  },
  {
    id: 'AUTO-146', area: 'Payout, Charges & Legs', priority: 'P0', automation: 'auto',
    title: 'A hand-loan advance is financed inside the principal and paid out once',
    rules: ['AF-1'],
    steps: ['Quote the reference with handLoanAmount 50000 and the three charges'],
    expected: ['principal 450000', 'grossPayout 450000', 'netPayout 440000', 'The advance is never counted twice — once in the principal and again in the payout'],
  },
  {
    id: 'AUTO-147', area: 'Payout, Charges & Legs', priority: 'P0', automation: 'auto',
    title: 'Charges that swallow the whole payout are refused',
    steps: ['Quote the reference with an insurance charge equal to the principal'],
    expected: ['Refused with "Recovered charges must be less than the gross payout."', 'A contract that hands the borrower nothing is never originated'],
  },
  {
    id: 'AUTO-148', area: 'Payout, Charges & Legs', priority: 'P0', automation: 'auto',
    title: 'Two payout legs must sum to the net payout',
    rules: ['AF-1'],
    steps: ['Quote with legs of 200000 cash and 190000 bank against a 390000 payout'],
    expected: ['Accepted', 'Both legs are persisted with their modes'],
  },
  {
    id: 'AUTO-149', area: 'Payout, Charges & Legs', priority: 'P0', automation: 'auto',
    title: 'A split that does not add up is refused with both figures',
    steps: ['Quote with legs of 200000 and 100000 against a 390000 payout'],
    expected: ['Refused naming the split total (300000) and the payout (390000)', 'The operator can see the gap without doing the arithmetic'],
  },
  {
    id: 'AUTO-150', area: 'Payout, Charges & Legs', priority: 'P1', automation: 'auto',
    title: 'An empty split defaults to a single cash leg for the whole payout',
    steps: ['Quote with both leg amounts omitted'],
    expected: ['One leg: cash, 390000', 'cashPayout equals the net payout and nonCashPayout is 0'],
  },
  {
    id: 'AUTO-151', area: 'Payout, Charges & Legs', priority: 'P1', automation: 'auto',
    title: 'A leg with an amount but no mode is refused',
    steps: ['Quote with payoutAmount1 200000 and no payoutMode1'],
    expected: ['Refused with "Payout mode 1 is required."'],
  },
  {
    id: 'AUTO-152', area: 'Payout, Charges & Legs', priority: 'P1', automation: 'auto',
    title: 'An unsupported payout mode is refused',
    steps: ['Quote with payoutMode1 "crypto"'],
    expected: ['Refused with "Payout mode 1 is not supported."', 'Only the ten known modes reach a payout row'],
  },
  {
    id: 'AUTO-153', area: 'Payout, Charges & Legs', priority: 'P1', automation: 'auto',
    title: 'Payout modes are matched case-insensitively',
    steps: ['Quote with payoutMode1 "CASH" and payoutMode2 "Bank_Transfer"'],
    expected: ['Both accepted', 'The stored mode is lowercase'],
  },
  {
    id: 'AUTO-154', area: 'Payout, Charges & Legs', priority: 'P0', automation: 'auto',
    title: 'Only the cash legs count as cash out of the branch pool',
    rules: ['MONEY-17'],
    steps: ['Originate with 200000 cash and 190000 bank'],
    expected: ['cashPayout 200000 and nonCashPayout 190000', 'The branch cash pool falls by 200000, not by 390000'],
  },
  {
    id: 'AUTO-155', area: 'Payout, Charges & Legs', priority: 'P0', automation: 'auto',
    title: 'A cash payout larger than the branch pool is refused',
    rules: ['MONEY-16', 'X-14'],
    steps: ['Drop the branch pool below the cash leg', 'Originate'],
    expected: ['Refused as insufficient float, surfaced as 409', 'No loan, no vehicle and no schedule are left behind'],
  },
  {
    id: 'AUTO-156', area: 'Payout, Charges & Legs', priority: 'P1', automation: 'auto',
    title: 'A negative payout leg amount is refused',
    steps: ['Quote with payoutAmount1 −1000'],
    expected: ['Refused with "Payout amount 1 cannot be negative."'],
  },
  {
    id: 'AUTO-157', area: 'Payout, Charges & Legs', priority: 'P2', automation: 'auto',
    title: 'A split within a paisa of the payout is accepted',
    steps: ['Quote with legs summing to 389999.995 against 390000'],
    expected: ['Accepted — the tolerance is one paisa, so decimal rounding does not block a correct split'],
  },
  {
    id: 'AUTO-158', area: 'Payout, Charges & Legs', priority: 'P2', automation: 'manual',
    title: 'The wizard shows the payout breakdown before the operator commits',
    steps: ['Fill the origination wizard through to the payout step'],
    expected: ['Gross, charges recovered and net are shown separately', 'The figures match what is written on submit'],
  },

  // ──────────────────── H. Due Dates & Schedule ────────────────────
  {
    id: 'AUTO-170', area: 'Due Dates & Schedule', priority: 'P0', automation: 'auto',
    title: 'The first due date defaults to one month after the issue date',
    steps: ['Originate with startDate 2026-01-15 and no dueDay or firstDueDate'],
    expected: ['Instalment 1 falls on 2026-02-15', 'Instalment 2 on 2026-03-15'],
  },
  {
    id: 'AUTO-171', area: 'Due Dates & Schedule', priority: 'P0', automation: 'auto',
    title: 'An explicit dueDay sets the day of the month',
    steps: ['Originate with startDate 2026-01-20 and dueDay 5'],
    expected: ['Instalment 1 falls on 2026-02-05', 'Every later instalment falls on the 5th'],
  },
  {
    id: 'AUTO-172', area: 'Due Dates & Schedule', priority: 'P0', automation: 'auto',
    title: 'A month-end due day clamps to the shortest month',
    steps: ['Originate with startDate 2026-01-31 and no dueDay'],
    expected: ['Instalment 1 falls on 2026-02-28, never 2026-03-03', 'The dueDay carried forward is the clamped day, so the whole schedule follows it'],
  },
  {
    id: 'AUTO-173', area: 'Due Dates & Schedule', priority: 'P1', automation: 'auto',
    title: 'A leap-year February clamps to the 29th',
    steps: ['Originate with startDate 2028-01-31'],
    expected: ['Instalment 1 falls on 2028-02-29'],
  },
  {
    id: 'AUTO-174', area: 'Due Dates & Schedule', priority: 'P1', automation: 'auto',
    title: 'An explicit first due date is honoured',
    steps: ['Originate with firstDueDate 2026-03-10'],
    expected: ['Instalment 1 falls on 2026-03-10', 'Later instalments follow the 10th'],
  },
  {
    id: 'AUTO-175', area: 'Due Dates & Schedule', priority: 'P0', automation: 'auto',
    title: 'A first due date on or before the issue date is refused',
    steps: ['Originate with firstDueDate equal to the issue date, then earlier'],
    expected: ['Both refused with "First due date must be after the issue date."', 'A schedule that starts in the past is never generated'],
  },
  {
    id: 'AUTO-176', area: 'Due Dates & Schedule', priority: 'P1', automation: 'auto',
    title: 'A due day outside 1–31 is refused',
    steps: ['Originate with dueDay 0, then 32, then 5.5'],
    expected: ['All three refused with the 1-to-31 message'],
  },
  {
    id: 'AUTO-177', area: 'Due Dates & Schedule', priority: 'P1', automation: 'auto',
    title: 'An invalid issue date is refused',
    steps: ['Originate with startDate "not-a-date"'],
    expected: ['Refused with "Issue date is invalid."'],
  },
  {
    id: 'AUTO-178', area: 'Due Dates & Schedule', priority: 'P1', automation: 'auto',
    title: 'The schedule has exactly one row per month of the tenure',
    rules: ['AF-2'],
    steps: ['Originate the reference over 24 months'],
    expected: ['24 instalments numbered 1..24', 'Each due date is one month after the last'],
  },
  {
    id: 'AUTO-179', area: 'Due Dates & Schedule', priority: 'P0', automation: 'auto',
    title: 'An HP loan is always monthly, whatever the request body says',
    rules: ['AF-2'],
    steps: ['POST an HP origination with frequency "daily"'],
    expected: ['The stored loan reads frequency monthly', 'The body value is ignored, not honoured'],
  },
  {
    id: 'AUTO-180', area: 'Due Dates & Schedule', priority: 'P0', automation: 'auto',
    title: 'The stored tenure comes from the generated schedule',
    rules: ['AF-2'],
    steps: ['POST an HP origination whose body tenure disagrees with the schedule length'],
    expected: ['The stored tenure equals the number of generated instalments'],
  },
  {
    id: 'AUTO-181', area: 'Due Dates & Schedule', priority: 'P2', automation: 'auto',
    title: 'Due dates are stored as calendar dates, not local timestamps',
    steps: ['Read the generated due dates from the database'],
    expected: ['Each is UTC midnight of the intended day', 'No instalment slips to the previous day in a different timezone'],
  },

  // ─────────────────────── I. HP Origination ───────────────────────
  {
    id: 'AUTO-200', area: 'HP Origination', priority: 'P0', automation: 'auto',
    title: 'A complete HP origination persists the loan, the schedule and the vehicle together',
    rules: ['AF-3'],
    steps: ['POST /api/v1/loans with an autoFinance body and a vehicle'],
    expected: ['Loan, 24 instalments, Vehicle and AutoFinanceDetail all exist', 'Every one of them carries the same tenant and branch'],
  },
  {
    id: 'AUTO-201', area: 'HP Origination', priority: 'P0', automation: 'auto',
    title: 'Origination is atomic — a failure part-way leaves nothing behind',
    rules: ['AF-3', 'DB-8'],
    steps: ['Force the vehicle insert to fail on a duplicate registration after the loan row is built'],
    expected: ['No loan, no instalment, no vehicle, no detail row', 'The four-step wizard is one operation from the operator’s point of view'],
  },
  {
    id: 'AUTO-202', area: 'HP Origination', priority: 'P0', automation: 'auto',
    title: 'The persisted loan carries the terms the builder computed',
    rules: ['AF-1'],
    steps: ['Originate the reference and read the loan row'],
    expected: ['principal 400000, totalPayable 496000, perInstalment 20666.67', 'deductionType emi_flat for a flat contract'],
  },
  {
    id: 'AUTO-203', area: 'HP Origination', priority: 'P0', automation: 'auto',
    title: 'A diminishing contract is stored as emi_floating',
    rules: ['AF-1'],
    steps: ['Originate with interestMethod diminishing'],
    expected: ['deductionType emi_floating', 'The schedule carries per-row principal and interest components'],
  },
  {
    id: 'AUTO-204', area: 'HP Origination', priority: 'P0', automation: 'auto',
    title: 'Each instalment stores its own principal and interest split',
    rules: ['AF-1'],
    steps: ['Read the generated instalments'],
    expected: ['principalComponent and interestComponent are persisted per row', 'They sum to the row’s dueAmount'],
  },
  {
    id: 'AUTO-205', area: 'HP Origination', priority: 'P1', automation: 'auto',
    title: 'The financed vehicle is linked to its loan',
    rules: ['AF-3'],
    steps: ['Originate with a vehicle and read both rows'],
    expected: ['Vehicle.loanId points at the loan', 'The loan detail shows the vehicle inline in list views'],
  },
  {
    id: 'AUTO-206', area: 'HP Origination', priority: 'P0', automation: 'auto',
    title: 'A registration already in the registry is refused before anything is written',
    rules: ['AF-4'],
    steps: ['Originate against a registration that already exists'],
    expected: ['HTTP 409 naming the vehicle', 'No loan row is created — the wizard reports a clean error rather than failing after the money is booked'],
  },
  {
    id: 'AUTO-207', area: 'HP Origination', priority: 'P0', automation: 'auto',
    title: 'The origination path normalises the registration to uppercase',
    rules: ['AF-4'],
    steps: ['Originate with registrationNo "tn39cd5678"'],
    expected: ['The stored vehicle reads TN39CD5678', 'A later registry search for either case finds it'],
  },
  {
    id: 'AUTO-208', area: 'HP Origination', priority: 'P0', automation: 'auto',
    title: 'A broker or dealer from another tenant is refused',
    rules: ['SCOPE-1', 'API-5'],
    steps: ['Originate with a brokerId belonging to tenant B'],
    expected: ['HTTP 404 "Selected broker not found"', 'A crafted id cannot link a loan across tenants'],
  },
  {
    id: 'AUTO-209', area: 'HP Origination', priority: 'P1', automation: 'auto',
    title: 'A dealer id that names a broker is refused',
    steps: ['Originate passing a broker’s id as dealerId'],
    expected: ['HTTP 404 "Selected dealer not found"', 'The partner type is checked, not just the ownership'],
  },
  {
    id: 'AUTO-210', area: 'HP Origination', priority: 'P1', automation: 'auto',
    title: 'A soft-deleted partner cannot be attached',
    rules: ['DB-4'],
    steps: ['Soft-delete the broker, then originate naming it'],
    expected: ['HTTP 404'],
  },
  {
    id: 'AUTO-211', area: 'HP Origination', priority: 'P0', automation: 'auto',
    title: 'The disbursement posts to the cash book and the GL',
    rules: ['ACC-6'],
    steps: ['Originate the reference and read the accounting rows'],
    expected: ['A disbursement entry for the net payout', 'The journal balances', 'Nothing is posted for a refused origination'],
  },
  {
    id: 'AUTO-212', area: 'HP Origination', priority: 'P1', automation: 'auto',
    title: 'Recovered charges are booked as income, not netted into the principal',
    rules: ['ACC-6'],
    steps: ['Originate with insurance, document and broker charges'],
    expected: ['The charges appear as their own entries', 'The loan principal still reads 400000'],
  },
  {
    id: 'AUTO-213', area: 'HP Origination', priority: 'P1', automation: 'auto',
    title: 'An agent cannot originate beyond their own book',
    rules: ['SCOPE-3', 'ROLE-4'],
    steps: ['As agent A1 originate for a customer on another agent’s route'],
    expected: ['Refused with 404'],
  },
  {
    id: 'AUTO-214', area: 'HP Origination', priority: 'P1', automation: 'auto',
    title: 'A loan code is generated with the auto-finance prefix',
    steps: ['Originate two HP loans'],
    expected: ['Both carry a distinct code with the module prefix', 'No two loans in a tenant share a code'],
  },
  {
    id: 'AUTO-215', area: 'HP Origination', priority: 'P1', automation: 'auto',
    title: 'A duplicate voucher reference is refused',
    steps: ['Originate twice with the same voucherRef'],
    expected: ['The second is refused with 409 quoting the reference'],
  },
  {
    id: 'AUTO-216', area: 'HP Origination', priority: 'P2', automation: 'auto',
    title: 'Origination without a vehicle is still possible for a top-up advance',
    steps: ['Originate an autoFinance loan with no vehicle body'],
    expected: ['Either refused with a clear message, or accepted with no vehicle linked', 'Whichever it is, no half-linked vehicle row is left'],
  },
  {
    id: 'AUTO-217', area: 'HP Origination', priority: 'P2', automation: 'manual',
    title: 'The four-step wizard can be completed end to end in the browser',
    steps: ['Walk customer → vehicle → terms → payout and submit'],
    expected: ['Each step validates before the next', 'The confirmation shows the same EMI and payout the server persists'],
  },

  // ─────────────────────── J. Finance Partners ───────────────────────
  {
    id: 'AUTO-230', area: 'Finance Partners', priority: 'P1', automation: 'auto',
    title: 'A broker and a dealer can be created',
    steps: ['Create one partner of each type'],
    expected: ['Both persist with their type', 'They appear in the partner list'],
  },
  {
    id: 'AUTO-231', area: 'Finance Partners', priority: 'P1', automation: 'auto',
    title: 'An unknown partner type is refused',
    rules: ['API-4'],
    steps: ['Create a partner with type "financier"'],
    expected: ['Refused — only broker and dealer are accepted'],
  },
  {
    id: 'AUTO-232', area: 'Finance Partners', priority: 'P1', automation: 'auto',
    title: 'A partner without a name is refused',
    steps: ['Create with an empty name'],
    expected: ['Refused with a name validation message'],
  },
  {
    id: 'AUTO-233', area: 'Finance Partners', priority: 'P1', automation: 'auto',
    title: 'A partner can be deactivated and reactivated',
    steps: ['Set the partner inactive, then active'],
    expected: ['The status round-trips', 'An inactive partner is not offered in the origination picker'],
  },
  {
    id: 'AUTO-234', area: 'Finance Partners', priority: 'P1', automation: 'auto',
    title: 'Deleting a partner is a soft delete',
    rules: ['DB-4'],
    steps: ['Delete a partner that has loans against it'],
    expected: ['The row is soft-deleted, not removed', 'Existing loans still resolve their broker name'],
  },
  {
    id: 'AUTO-235', area: 'Finance Partners', priority: 'P1', automation: 'auto',
    title: 'An agent cannot create or delete a partner',
    rules: ['ROLE-4'],
    steps: ['Attempt both as agent A1'],
    expected: ['Both refused server-side, not merely hidden in the nav'],
  },
  {
    id: 'AUTO-236', area: 'Finance Partners', priority: 'P2', automation: 'auto',
    title: 'Partners are tenant-scoped',
    rules: ['SCOPE-1'],
    steps: ['List partners as tenant B'],
    expected: ['None of tenant A’s partners appear'],
  },
  {
    id: 'AUTO-237', area: 'Finance Partners', priority: 'P2', automation: 'auto',
    title: 'Loans can be filtered by broker',
    steps: ['Originate two loans against different brokers and filter the list'],
    expected: ['Only the selected broker’s loans are returned'],
  },
  {
    id: 'AUTO-238', area: 'Finance Partners', priority: 'P2', automation: 'auto',
    title: 'Broker commission is attributed to the partner on the loan',
    steps: ['Originate with a broker and a commission'],
    expected: ['The commission is recorded against that partner', 'A partner payout report can total it'],
  },

  // ───────────────────── K. Hand-Loan & Charges ─────────────────────
  {
    id: 'AUTO-250', area: 'Hand-Loan & Charges', priority: 'P0', automation: 'auto',
    title: 'A hand-loan advance is repaid inside the HP schedule',
    rules: ['AF-1'],
    steps: ['Originate the reference with handLoanAmount 50000'],
    expected: ['The instalments amortise 450000, not 400000', 'There is no second schedule for the advance'],
  },
  {
    id: 'AUTO-251', area: 'Hand-Loan & Charges', priority: 'P1', automation: 'auto',
    title: 'A seizing or storage charge advanced later joins the charges ledger',
    steps: ['Record a seizing charge against a live HP loan'],
    expected: ['It appears as an outstanding charge on the account', 'It is not silently folded into the principal'],
  },
  {
    id: 'AUTO-252', area: 'Hand-Loan & Charges', priority: 'P1', automation: 'auto',
    title: 'Outstanding charges appear in the settlement figure',
    steps: ['Quote a settlement on a loan carrying 2000 of charges'],
    expected: ['chargesOutstanding 2000 is included in the final amount'],
  },
  {
    id: 'AUTO-253', area: 'Hand-Loan & Charges', priority: 'P1', automation: 'auto',
    title: 'A charge cannot be negative',
    steps: ['Record a charge of −500'],
    expected: ['Refused — a credit note is a different operation from a negative charge'],
  },
  {
    id: 'AUTO-254', area: 'Hand-Loan & Charges', priority: 'P2', automation: 'auto',
    title: 'Charges are visible on the customer ledger tab',
    steps: ['Open the ledger for a loan with charges'],
    expected: ['Each charge is listed with its date and reason'],
  },

  // ────────────── L. EMI Collection — Waterfall ──────────────
  {
    id: 'AUTO-270', area: 'EMI Collection — Waterfall', priority: 'P0', automation: 'auto',
    title: 'A lump sum settles the oldest overdue row first',
    pre: 'Instalments 1 and 2 overdue at 20666.67 each, instalment 1 carrying a 500 penalty; instalment 3 upcoming',
    steps: ['Offer 25000'],
    expected: ['Penalty 500 on instalment 1 is cleared first', 'Then instalment 1 in full', 'The remaining 3833.33 lands on instalment 2'],
  },
  {
    id: 'AUTO-271', area: 'EMI Collection — Waterfall', priority: 'P0', automation: 'auto',
    title: 'Penalty on a row is cleared before the instalment itself',
    steps: ['Offer exactly 500 against the fixture'],
    expected: ['penaltyPaid 500 and duePaid 0', 'The instalment is untouched'],
  },
  {
    id: 'AUTO-272', area: 'EMI Collection — Waterfall', priority: 'P0', automation: 'auto',
    title: 'Overdue rows are taken before upcoming ones whatever their number',
    steps: ['Make instalment 3 overdue and 1 and 2 upcoming, then offer one instalment’s worth'],
    expected: ['The overdue row is settled first', 'Date order decides within each group'],
  },
  {
    id: 'AUTO-273', area: 'EMI Collection — Waterfall', priority: 'P0', automation: 'auto',
    title: 'Money left after every row is settled is reported as unapplied',
    steps: ['Offer 100000 against a total outstanding of 62500.01'],
    expected: ['unapplied is the exact remainder', 'It is surfaced as an advance, never silently absorbed'],
  },
  {
    id: 'AUTO-274', area: 'EMI Collection — Waterfall', priority: 'P1', automation: 'auto',
    title: 'A partial payment leaves an honest outstandingAfter on the row it stopped at',
    steps: ['Offer 25000 against the fixture'],
    expected: ['Instalment 2 shows outstandingAfter 16833.34 and cleared false', 'remainingOutstanding equals the sum of every outstandingAfter'],
  },
  {
    id: 'AUTO-275', area: 'EMI Collection — Waterfall', priority: 'P1', automation: 'auto',
    title: 'A waived row is skipped entirely',
    steps: ['Mark instalment 1 waived and offer 25000'],
    expected: ['No line is produced for the waived row', 'The money starts at instalment 2'],
  },
  {
    id: 'AUTO-276', area: 'EMI Collection — Waterfall', priority: 'P1', automation: 'auto',
    title: 'A zero or negative offer plans nothing',
    steps: ['Offer 0, then −500'],
    expected: ['Every line reports applied 0', 'No negative application is ever produced'],
  },
  {
    id: 'AUTO-277', area: 'EMI Collection — Waterfall', priority: 'P0', automation: 'auto',
    title: 'The committed receipt matches the previewed plan exactly',
    steps: ['Preview a 25000 receipt in the modal, then submit it'],
    expected: ['The instalments updated are exactly those in the preview', 'Applied amounts match line for line'],
  },
  {
    id: 'AUTO-278', area: 'EMI Collection — Waterfall', priority: 'P0', automation: 'auto',
    title: 'A cash EMI receipt credits the collecting agent’s float',
    rules: ['MONEY-17'],
    steps: ['Collect 25000 in cash as agent A1'],
    expected: ['A1’s float rises by 25000', 'The cash book and the GL both record it'],
  },
  {
    id: 'AUTO-279', area: 'EMI Collection — Waterfall', priority: 'P0', automation: 'auto',
    title: 'A UPI EMI receipt does not move physical float',
    rules: ['MONEY-17'],
    steps: ['Collect 25000 by UPI'],
    expected: ['The instalments are settled and the GL records it', 'No agent float and no branch cash moves'],
  },
  {
    id: 'AUTO-280', area: 'EMI Collection — Waterfall', priority: 'P0', automation: 'auto',
    title: 'A replayed receipt does not post twice',
    rules: ['DB-11'],
    steps: ['Submit the same receipt twice with one idempotency key'],
    expected: ['One receipt, one set of instalment updates, one float movement'],
  },
  {
    id: 'AUTO-281', area: 'EMI Collection — Waterfall', priority: 'P1', automation: 'auto',
    title: 'A receipt cannot be posted against another branch’s loan',
    rules: ['SCOPE-3'],
    steps: ['Collect against the Erode loan while HQ is active'],
    expected: ['HTTP 404'],
  },
  {
    id: 'AUTO-282', area: 'EMI Collection — Waterfall', priority: 'P1', automation: 'auto',
    title: 'A fully repaid HP loan is derived as closed',
    rules: ['MONEY-11'],
    steps: ['Collect the whole outstanding'],
    expected: ['Loan status closed', 'No instalment is left upcoming, partial or missed'],
  },
  {
    id: 'AUTO-283', area: 'EMI Collection — Waterfall', priority: 'P2', automation: 'auto',
    title: 'Collecting on a closed loan is refused',
    steps: ['Collect again after closure'],
    expected: ['Refused with an already-paid conflict', 'No receipt is written'],
  },
  {
    id: 'AUTO-284', area: 'EMI Collection — Waterfall', priority: 'P2', automation: 'manual',
    title: 'The receipt modal preview reads the way a recovery desk works',
    steps: ['Open the receipt modal on an account with two overdue rows and a penalty'],
    expected: ['The plan is shown line by line before commit', 'Overdue rows are visually distinct from upcoming ones'],
  },

  // ─────────────────── M. Settlement & Closure ───────────────────
  {
    id: 'AUTO-300', area: 'Settlement & Closure', priority: 'P0', automation: 'auto',
    title: 'A settlement quote totals every outstanding head',
    steps: ['Quote with principal 200000, interest 30000, penalty 5000, charges 2000 and no discount'],
    expected: ['finalSettlementAmount 237000', 'Each head is reported separately so the customer can see what they are paying'],
  },
  {
    id: 'AUTO-301', area: 'Settlement & Closure', priority: 'P0', automation: 'auto',
    title: 'A discount can never exceed the head it is applied against',
    steps: ['Quote the same figures with an interest discount of 40000'],
    expected: ['The discount is clamped to the 30000 of interest outstanding', 'finalSettlementAmount 207000, never less than principal plus charges'],
  },
  {
    id: 'AUTO-302', area: 'Settlement & Closure', priority: 'P1', automation: 'auto',
    title: 'Interest and penalty discounts are applied to their own heads',
    steps: ['Quote with an interest discount of 10000 and a penalty discount of 1000'],
    expected: ['totalDiscount 11000', 'A penalty discount never eats into interest and vice versa'],
  },
  {
    id: 'AUTO-303', area: 'Settlement & Closure', priority: 'P1', automation: 'auto',
    title: 'A negative discount is treated as zero',
    steps: ['Quote with an interest discount of −5000'],
    expected: ['totalDiscount 0', 'A negative discount never inflates the settlement'],
  },
  {
    id: 'AUTO-304', area: 'Settlement & Closure', priority: 'P0', automation: 'auto',
    title: 'Settling closes the loan and releases the vehicle hold',
    steps: ['Post the settlement amount'],
    expected: ['Loan status closed', 'The vehicle is no longer flagged for repossession', 'The closure is audited'],
  },
  {
    id: 'AUTO-305', area: 'Settlement & Closure', priority: 'P0', automation: 'auto',
    title: 'A settlement short of the quoted figure does not close the loan',
    steps: ['Post 1000 less than the quote'],
    expected: ['Refused, or applied as a part payment with the loan left open', 'A loan is never closed for less than it was quoted without an explicit waiver'],
  },
  {
    id: 'AUTO-306', area: 'Settlement & Closure', priority: 'P1', automation: 'auto',
    title: 'A discount above a threshold needs approval',
    rules: ['ROLE-4'],
    steps: ['Apply a large discount as a branch admin'],
    expected: ['Either refused or routed to an approver', 'A waiver of interest is never a silent single-click action'],
  },
  {
    id: 'AUTO-307', area: 'Settlement & Closure', priority: 'P1', automation: 'auto',
    title: 'The settlement posts to the cash book and the GL',
    rules: ['ACC-6'],
    steps: ['Settle and read the accounting rows'],
    expected: ['Principal, interest, penalty and charge heads are posted separately', 'The discount is booked as a waiver, not as a collection'],
  },
  {
    id: 'AUTO-308', area: 'Settlement & Closure', priority: 'P2', automation: 'auto',
    title: 'Quoting a settlement twice gives the same figure on the same day',
    steps: ['Quote, wait, quote again with no activity between'],
    expected: ['Identical figures', 'A quote that drifts without a transaction is a defect'],
  },

  // ──────────────────── N. Due Chart & Ledger ────────────────────
  {
    id: 'AUTO-320', area: 'Due Chart & Ledger', priority: 'P1', automation: 'auto',
    title: 'A settled instalment reads as paid',
    steps: ['Build the ledger for a fully collected instalment'],
    expected: ['One row, tone paid, segment full', 'It carries its receipt number, paid date and payment mode'],
  },
  {
    id: 'AUTO-321', area: 'Due Chart & Ledger', priority: 'P1', automation: 'auto',
    title: 'An unpaid instalment past its date reads as overdue',
    steps: ['Build the ledger for an instalment due last month with nothing received'],
    expected: ['tone overdue', 'The amount shown is what is still owed, not the original due'],
  },
  {
    id: 'AUTO-322', area: 'Due Chart & Ledger', priority: 'P1', automation: 'auto',
    title: 'A future instalment reads as upcoming',
    steps: ['Build the ledger for next month’s instalment'],
    expected: ['tone upcoming', 'No penalty is attributed to a row that is not yet due'],
  },
  {
    id: 'AUTO-323', area: 'Due Chart & Ledger', priority: 'P0', automation: 'auto',
    title: 'A partly paid instalment is shown as two rows on one date',
    steps: ['Collect half of an overdue instalment and build the ledger'],
    expected: ['A paid row for what was collected and an overdue row for the balance', 'Both carry the same due date and instalment number', 'isSplit is true on both'],
  },
  {
    id: 'AUTO-324', area: 'Due Chart & Ledger', priority: 'P1', automation: 'auto',
    title: 'A split row divides principal and interest pro-rata',
    steps: ['Read the principal and interest on both halves of a split row'],
    expected: ['The two halves sum to the instalment’s own components', 'Neither half is given the whole interest'],
  },
  {
    id: 'AUTO-325', area: 'Due Chart & Ledger', priority: 'P1', automation: 'auto',
    title: 'The running balance falls down the chart',
    steps: ['Read runningBalance across the ledger'],
    expected: ['It decreases monotonically', 'It reaches zero on the final settled row'],
  },
  {
    id: 'AUTO-326', area: 'Due Chart & Ledger', priority: 'P2', automation: 'auto',
    title: 'Penalty outstanding is shown on the row it belongs to',
    steps: ['Accrue a penalty on instalment 2 and build the ledger'],
    expected: ['The penalty appears against instalment 2, not as a floating charge'],
  },
  {
    id: 'AUTO-327', area: 'Due Chart & Ledger', priority: 'P2', automation: 'manual',
    title: 'The three-colour chart is legible without colour alone',
    steps: ['Open the ledger tab and inspect the rows'],
    expected: ['Paid, overdue and upcoming are distinguishable by label as well as colour', 'A colour-blind operator can still read the chart'],
  },

  // ────────────── O. Vehicle Seizure & Release ──────────────
  {
    id: 'AUTO-340', area: 'Vehicle Seizure & Release', priority: 'P0', automation: 'auto',
    title: 'Flagging a vehicle for repossession records who and when',
    steps: ['Seize a vehicle with a reason'],
    expected: ['repoFlag true with repoFlaggedAt and repoFlaggedById set', 'The reason is stored and audited'],
  },
  {
    id: 'AUTO-341', area: 'Vehicle Seizure & Release', priority: 'P1', automation: 'auto',
    title: 'A seizure needs a reason',
    steps: ['Seize with an empty reason'],
    expected: ['Refused', 'A repossession is never recorded without why'],
  },
  {
    id: 'AUTO-342', area: 'Vehicle Seizure & Release', priority: 'P1', automation: 'auto',
    title: 'Releasing a vehicle clears the flag and keeps the history',
    steps: ['Release a seized vehicle'],
    expected: ['repoFlag false', 'The recovery record of the seizure survives — the vehicle’s history is not rewritten'],
  },
  {
    id: 'AUTO-343', area: 'Vehicle Seizure & Release', priority: 'P1', automation: 'auto',
    title: 'Seizing an already-seized vehicle is refused',
    steps: ['Seize twice'],
    expected: ['The second is refused', 'One open recovery per vehicle'],
  },
  {
    id: 'AUTO-344', area: 'Vehicle Seizure & Release', priority: 'P1', automation: 'auto',
    title: 'An agent cannot seize or release',
    rules: ['ROLE-4'],
    steps: ['Attempt both as agent A1'],
    expected: ['Both refused server-side'],
  },
  {
    id: 'AUTO-345', area: 'Vehicle Seizure & Release', priority: 'P1', automation: 'auto',
    title: 'Seized loans can be filtered from the loan list',
    steps: ['Filter the loan list with seized=true and seized=false'],
    expected: ['Each returns exactly the matching set', 'A recovery desk can work its own queue'],
  },
  {
    id: 'AUTO-346', area: 'Vehicle Seizure & Release', priority: 'P1', automation: 'auto',
    title: 'Seizing charges land on the charges ledger, not the principal',
    steps: ['Record a seizing charge during repossession'],
    expected: ['It is an outstanding charge on the account', 'The loan principal is unchanged'],
  },
  {
    id: 'AUTO-347', area: 'Vehicle Seizure & Release', priority: 'P2', automation: 'auto',
    title: 'A seized vehicle still shows on the customer 360 view',
    steps: ['Open the customer view for a seized asset'],
    expected: ['The vehicle is listed with its repossession state and date'],
  },
  {
    id: 'AUTO-348', area: 'Vehicle Seizure & Release', priority: 'P2', automation: 'auto',
    title: 'A seizure on another branch’s vehicle is refused',
    rules: ['SCOPE-3'],
    steps: ['Seize the Erode vehicle while HQ is active'],
    expected: ['HTTP 404'],
  },

  // ─────────────────── P. Pending Tasks Queue ───────────────────
  {
    id: 'AUTO-360', area: 'Pending Tasks Queue', priority: 'P1', automation: 'auto',
    title: 'The pending queue lists the work waiting on this branch',
    rules: ['SCOPE-12'],
    steps: ['Open the pending-tasks page as an HQ admin'],
    expected: ['Vehicle approvals, overdue follow-ups and unclosed days for HQ only', 'No Erode item appears'],
  },
  {
    id: 'AUTO-361', area: 'Pending Tasks Queue', priority: 'P1', automation: 'auto',
    title: 'A completed task leaves the queue',
    steps: ['Approve the pending vehicle and reload the queue'],
    expected: ['The item is gone', 'The count on the dashboard agrees with the list'],
  },
  {
    id: 'AUTO-362', area: 'Pending Tasks Queue', priority: 'P1', automation: 'auto',
    title: 'An agent sees only their own tasks',
    rules: ['ROLE-4'],
    steps: ['Open the queue as agent A1'],
    expected: ['Only A1’s own submissions and collections', 'No branch-wide approval work'],
  },
  {
    id: 'AUTO-363', area: 'Pending Tasks Queue', priority: 'P2', automation: 'auto',
    title: 'An empty queue renders as empty, not as an error',
    steps: ['Open the queue on a fresh branch'],
    expected: ['A zero state is rendered', 'No exception and no blank page'],
  },

  // ──────────────────────── Q. Login Window ────────────────────────
  {
    id: 'AUTO-380', area: 'Login Window', priority: 'P0', automation: 'auto',
    title: 'A user with no window set can log in at any time',
    rules: ['AF-5'],
    steps: ['Leave allowedLoginStart and allowedLoginEnd null and authenticate'],
    expected: ['Allowed', 'The default for every existing user is no restriction'],
  },
  {
    id: 'AUTO-381', area: 'Login Window', priority: 'P0', automation: 'auto',
    title: 'An agent inside their window is allowed',
    rules: ['AF-5'],
    steps: ['Set 08:00–20:00 and authenticate at 09:00 IST'],
    expected: ['Allowed', 'No message is attached'],
  },
  {
    id: 'AUTO-382', area: 'Login Window', priority: 'P0', automation: 'auto',
    title: 'An agent outside their window is refused with the window quoted',
    rules: ['AF-5'],
    steps: ['Set 08:00–20:00 and authenticate at 21:00 IST'],
    expected: ['Refused', 'The message names the allowed window so the agent knows when to try again'],
  },
  {
    id: 'AUTO-383', area: 'Login Window', priority: 'P1', automation: 'auto',
    title: 'A window that spans midnight is honoured',
    rules: ['AF-5'],
    steps: ['Set 22:00–06:00', 'Authenticate at 23:00, then at 03:00, then at 07:00'],
    expected: ['The first two are allowed', 'Only 07:00 is refused — a night recovery shift is a real shift'],
  },
  {
    id: 'AUTO-384', area: 'Login Window', priority: 'P1', automation: 'auto',
    title: 'The window boundaries are inclusive',
    rules: ['AF-5'],
    steps: ['Set 08:00–20:00 and authenticate at exactly 08:00, then at exactly 20:00'],
    expected: ['Both allowed'],
  },
  {
    id: 'AUTO-385', area: 'Login Window', priority: 'P1', automation: 'auto',
    title: 'A half-configured window does not lock anyone out',
    rules: ['AF-5'],
    steps: ['Set only allowedLoginStart and authenticate at midnight'],
    expected: ['Allowed — the check fails open when it cannot be evaluated'],
  },
  {
    id: 'AUTO-386', area: 'Login Window', priority: 'P1', automation: 'auto',
    title: 'A malformed window value disables the restriction rather than misapplying it',
    rules: ['AF-5'],
    pre: 'parseTimeOfDay returns null for "25:00", which reads the same as unset',
    steps: ['Store allowedLoginStart "25:00" and authenticate'],
    expected: ['Allowed', 'A typo in a control that is meant to restrict must be visible to whoever set it, not silently ignored'],
  },
  {
    id: 'AUTO-387', area: 'Login Window', priority: 'P0', automation: 'auto',
    title: 'Owners are exempt from the window',
    rules: ['AF-5'],
    steps: ['Set a window on a superadmin and authenticate outside it'],
    expected: ['Allowed — an owner is never locked out of their own workspace'],
  },
  {
    id: 'AUTO-388', area: 'Login Window', priority: 'P0', automation: 'auto',
    title: 'The web session and the mobile token apply the same carve-out',
    rules: ['AF-5'],
    steps: ['Authenticate the same restricted agent through /login and through the v1 token mint, outside the window'],
    expected: ['Both refuse', 'A restriction enforced on one surface only is not a restriction'],
  },
  {
    id: 'AUTO-389', area: 'Login Window', priority: 'P1', automation: 'auto',
    title: 'The window is evaluated in IST, not in the server’s timezone',
    rules: ['AF-5'],
    steps: ['Authenticate at an instant that is inside the window in IST and outside it in UTC'],
    expected: ['Allowed — the business day is the Indian business day'],
  },
  {
    id: 'AUTO-390', area: 'Login Window', priority: 'P2', automation: 'auto',
    title: 'An already-issued token is not revoked mid-shift by the window closing',
    rules: ['AF-5'],
    steps: ['Mint a token inside the window, then call an API after it closes'],
    expected: ['The documented behaviour holds either way', 'An agent is not cut off mid-collection without warning, or is, deliberately'],
  },

  // ───────────────────────── R. Day Closing ─────────────────────────
  {
    id: 'AUTO-405', area: 'Day Closing', priority: 'P0', automation: 'auto',
    title: 'The expected closing cash is opening plus collected less disbursed',
    steps: ['Summarise a day with opening 10000, collected 50000, disbursed 20000'],
    expected: ['expectedClosing 40000'],
  },
  {
    id: 'AUTO-406', area: 'Day Closing', priority: 'P0', automation: 'auto',
    title: 'A counted total that matches balances the day',
    steps: ['Count 40000 against the same day'],
    expected: ['variance 0 and balanced true'],
  },
  {
    id: 'AUTO-407', area: 'Day Closing', priority: 'P0', automation: 'auto',
    title: 'A short count is reported as a negative variance',
    steps: ['Count 39500'],
    expected: ['variance −500 and balanced false', 'The shortfall is surfaced, never absorbed'],
  },
  {
    id: 'AUTO-408', area: 'Day Closing', priority: 'P1', automation: 'auto',
    title: 'Sub-rupee drift does not block a close',
    steps: ['Count 39999.50'],
    expected: ['variance −0.50 and balanced true', 'Decimal rounding is not treated as a cash shortage'],
  },
  {
    id: 'AUTO-409', area: 'Day Closing', priority: 'P1', automation: 'auto',
    title: 'An excess count is reported too',
    steps: ['Count 40500'],
    expected: ['variance +500 and balanced false', 'Cash over is as much a discrepancy as cash short'],
  },
  {
    id: 'AUTO-410', area: 'Day Closing', priority: 'P0', automation: 'auto',
    title: 'Staff are blocked until the previous business day is closed',
    steps: ['Leave yesterday unclosed and open the pending list'],
    expected: ['blocked true with yesterday named', 'The message tells the operator exactly which date to close'],
  },
  {
    id: 'AUTO-411', area: 'Day Closing', priority: 'P0', automation: 'auto',
    title: 'Closing yesterday lifts the block',
    steps: ['Close yesterday and re-evaluate the gate'],
    expected: ['blocked false with no pending date'],
  },
  {
    id: 'AUTO-412', area: 'Day Closing', priority: 'P1', automation: 'auto',
    title: 'A brand-new workspace is not blocked on its first day',
    steps: ['Evaluate the gate with a first-activity date of today'],
    expected: ['blocked false — days before the tenant existed never needed closing'],
  },
  {
    id: 'AUTO-413', area: 'Day Closing', priority: 'P1', automation: 'auto',
    title: 'The business date rolls over at IST midnight',
    steps: ['Evaluate the business date key just before and just after IST midnight'],
    expected: ['The key advances by one day at the right instant, not at UTC midnight'],
  },
  {
    id: 'AUTO-414', area: 'Day Closing', priority: 'P1', automation: 'auto',
    title: 'A closed day cannot be closed again',
    steps: ['Close the same business date twice'],
    expected: ['The second attempt is refused', 'One closing record per branch per day'],
  },
  {
    id: 'AUTO-415', area: 'Day Closing', priority: 'P1', automation: 'auto',
    title: 'Day closing is per branch',
    rules: ['SCOPE-3'],
    steps: ['Close HQ and evaluate the Erode gate'],
    expected: ['Erode is still blocked — one branch’s count says nothing about another’s cash'],
  },
  {
    id: 'AUTO-416', area: 'Day Closing', priority: 'P2', automation: 'auto',
    title: 'The closing figures reconcile against the day’s receipts',
    steps: ['Compare collectedCash against the day’s cash receipts'],
    expected: ['They agree exactly', 'Non-cash receipts are excluded from the cash count'],
  },

  // ────────────────────── S. Accounting & Float ──────────────────────
  {
    id: 'AUTO-430', area: 'Accounting & Float', priority: 'P0', automation: 'auto',
    title: 'A cash disbursement debits the branch pool',
    rules: ['MONEY-17'],
    steps: ['Originate with a full cash payout and read the pool'],
    expected: ['The pool falls by the net cash payout', 'A wallet transaction records the movement'],
  },
  {
    id: 'AUTO-431', area: 'Accounting & Float', priority: 'P0', automation: 'auto',
    title: 'A bank leg does not move physical cash',
    rules: ['MONEY-17'],
    steps: ['Originate with the whole payout as a bank transfer'],
    expected: ['The GL records the disbursement', 'The branch cash pool is unchanged'],
  },
  {
    id: 'AUTO-432', area: 'Accounting & Float', priority: 'P0', automation: 'auto',
    title: 'Float never goes negative on a disbursement',
    rules: ['MONEY-16', 'X-14'],
    steps: ['Attempt a cash payout larger than the pool'],
    expected: ['Refused as insufficient float with a 409', 'The balance is never driven below zero'],
  },
  {
    id: 'AUTO-433', area: 'Accounting & Float', priority: 'P1', automation: 'auto',
    title: 'An agent handover moves cash from the agent to the branch',
    rules: ['MONEY-16'],
    steps: ['Collect cash as A1, then hand it over'],
    expected: ['A1’s float falls and the branch pool rises by the same amount', 'Cash is moved, never created'],
  },
  {
    id: 'AUTO-434', area: 'Accounting & Float', priority: 'P1', automation: 'auto',
    title: 'The journal balances after every auto-finance posting',
    rules: ['ACC-6'],
    steps: ['Run origination, collection and settlement, then check the trial balance'],
    expected: ['Debits equal credits at every step'],
  },
  {
    id: 'AUTO-435', area: 'Accounting & Float', priority: 'P1', automation: 'auto',
    title: 'A locked accounting period refuses a backdated posting',
    steps: ['Lock the period and post a receipt dated inside it'],
    expected: ['Refused with a period-lock conflict', 'A closed book is not reopened by a collection'],
  },
  {
    id: 'AUTO-436', area: 'Accounting & Float', priority: 'P2', automation: 'auto',
    title: 'Auto-finance postings carry the autofinance appType',
    rules: ['SCOPE-1'],
    steps: ['Read the account entries created by the journey'],
    expected: ['Every entry is stamped autofinance', 'None appears in another module’s ledger'],
  },

  // ─────────────────────── T. Penalties & NPA ───────────────────────
  {
    id: 'AUTO-450', area: 'Penalties & NPA', priority: 'P1', automation: 'auto',
    title: 'A missed EMI accrues a penalty at the configured rate',
    steps: ['Run the penalty cron over an overdue instalment'],
    expected: ['A penalty is accrued against that row', 'It respects the grace period and the cap'],
  },
  {
    id: 'AUTO-451', area: 'Penalties & NPA', priority: 'P1', automation: 'auto',
    title: 'A penalty stops growing at the configured cap',
    steps: ['Run the cron repeatedly past the cap'],
    expected: ['The charge stops at the cap', 'A charge already set does not grow past it'],
  },
  {
    id: 'AUTO-452', area: 'Penalties & NPA', priority: 'P1', automation: 'auto',
    title: 'The penalty cron is idempotent for a day',
    rules: ['CRON-1'],
    steps: ['Run the accrual twice for the same day'],
    expected: ['One accrual', 'The second run is a no-op'],
  },
  {
    id: 'AUTO-453', area: 'Penalties & NPA', priority: 'P1', automation: 'auto',
    title: 'An HP loan is classified by days past due',
    rules: ['NPA-1'],
    steps: ['Age an account past each classification threshold and run the classifier'],
    expected: ['The stage matches the days past due', 'The classification is recorded with its date'],
  },
  {
    id: 'AUTO-454', area: 'Penalties & NPA', priority: 'P1', automation: 'auto',
    title: 'An upgrade needs clean instalments and an explicit action',
    rules: ['NPA-7'],
    steps: ['Collect the arrears and attempt an upgrade'],
    expected: ['The upgrade requires the documented number of clean instalments and an admin action', 'It never happens silently on payment'],
  },
  {
    id: 'AUTO-455', area: 'Penalties & NPA', priority: 'P2', automation: 'auto',
    title: 'A seized account is visible in the NPA view',
    steps: ['Seize a vehicle on an NPA account and open the view'],
    expected: ['The account shows both its stage and its repossession state'],
  },

  // ────────────── U. Branch & Tenant Isolation ──────────────
  {
    id: 'AUTO-470', area: 'Branch & Tenant Isolation', priority: 'P0', automation: 'auto',
    title: 'A vehicle id from another tenant returns 404, not 403',
    rules: ['API-5', 'X-12'],
    steps: ['GET a tenant-B vehicle with a tenant-A token'],
    expected: ['HTTP 404'],
  },
  {
    id: 'AUTO-471', area: 'Branch & Tenant Isolation', priority: 'P0', automation: 'auto',
    title: 'Switching branch switches the whole auto-finance surface',
    rules: ['SCOPE-3'],
    steps: ['Switch to Erode and reload vehicles, loans, partners and pending tasks'],
    expected: ['Every list shows Erode rows only'],
  },
  {
    id: 'AUTO-472', area: 'Branch & Tenant Isolation', priority: 'P0', automation: 'auto',
    title: 'Money lands in the branch that owns the loan',
    rules: ['SCOPE-3', 'MONEY-17'],
    steps: ['Collect on an Erode loan while HQ is the active branch'],
    expected: ['The Erode pool moves, not HQ', 'The receipt carries the Erode branch'],
  },
  {
    id: 'AUTO-473', area: 'Branch & Tenant Isolation', priority: 'P1', automation: 'auto',
    title: 'The agent-performance figures are branch-scoped',
    rules: ['SCOPE-12'],
    steps: ['Read the agent report under each branch'],
    expected: ['Neither branch’s report includes the other’s agents'],
  },
  {
    id: 'AUTO-474', area: 'Branch & Tenant Isolation', priority: 'P1', automation: 'auto',
    title: 'A soft-deleted vehicle disappears from every list and report',
    rules: ['DB-4'],
    steps: ['Soft-delete a vehicle and re-read the registry, the loan list and the reports'],
    expected: ['It is gone from all of them', 'Its historical receipts survive'],
  },

  // ──────────────────────────── V. RBAC ────────────────────────────
  {
    id: 'AUTO-490', area: 'RBAC', priority: 'P0', automation: 'auto',
    title: 'An agent cannot reach analytics, reports, penalties or settings',
    rules: ['ROLE-4'],
    steps: ['Request each blocked page and its API as agent A1'],
    expected: ['Every handler refuses server-side, not merely a nav redirect'],
  },
  {
    id: 'AUTO-491', area: 'RBAC', priority: 'P0', automation: 'auto',
    title: 'An agent cannot originate a loan without the bypass flag',
    rules: ['ROLE-5'],
    steps: ['Originate as A1 with bypassLoanApproval false'],
    expected: ['The loan is held for approval rather than going live'],
  },
  {
    id: 'AUTO-492', area: 'RBAC', priority: 'P1', automation: 'auto',
    title: 'The agent-only flags do not gate an admin',
    rules: ['ROLE-5'],
    steps: ['Originate as an admin with the flags unset'],
    expected: ['Origination proceeds — the flags are agent controls'],
  },
  {
    id: 'AUTO-493', area: 'RBAC', priority: 'P1', automation: 'auto',
    title: 'A deactivated staff account cannot authenticate',
    rules: ['AUTH-4'],
    steps: ['Deactivate A1 and attempt both web and API login'],
    expected: ['Both refused', 'An existing token stops working on the next request'],
  },
  {
    id: 'AUTO-494', area: 'RBAC', priority: 'P1', automation: 'auto',
    title: 'Only an admin or above can edit the vehicle registry',
    rules: ['ROLE-4'],
    steps: ['PATCH a vehicle as an agent'],
    expected: ['Refused, unless the agent holds the documented capability — and then only on their own book'],
  },

  // ─────────────────── W. Dashboard & Reports ───────────────────
  {
    id: 'AUTO-510', area: 'Dashboard & Reports', priority: 'P1', automation: 'auto',
    title: 'The dashboard totals match the underlying rows',
    steps: ['Read the dashboard after a known set of originations and collections'],
    expected: ['Disbursed, collected and outstanding equal the sums of the rows'],
  },
  {
    id: 'AUTO-511', area: 'Dashboard & Reports', priority: 'P1', automation: 'auto',
    title: 'Dashboard figures are branch-scoped',
    rules: ['SCOPE-3'],
    steps: ['Compare the dashboard under HQ and Erode'],
    expected: ['Neither includes the other’s numbers'],
  },
  {
    id: 'AUTO-512', area: 'Dashboard & Reports', priority: 'P1', automation: 'auto',
    title: 'The overdue report lists accounts by days past due',
    steps: ['Age three accounts differently and run the report'],
    expected: ['Ordered by days past due', 'The figures match the instalment rows'],
  },
  {
    id: 'AUTO-513', area: 'Dashboard & Reports', priority: 'P2', automation: 'auto',
    title: 'A vehicle-type breakdown totals to the portfolio',
    steps: ['Run the portfolio report across vehicle types'],
    expected: ['The type totals sum to the whole portfolio', 'No loan is counted twice or dropped'],
  },
  {
    id: 'AUTO-514', area: 'Dashboard & Reports', priority: 'P2', automation: 'auto',
    title: 'An empty branch reports zeroes, not errors',
    steps: ['Run every report on a branch with no loans'],
    expected: ['Zero totals render', 'No division by zero and no NaN'],
  },
  {
    id: 'AUTO-515', area: 'Dashboard & Reports', priority: 'P2', automation: 'manual',
    title: 'Exported figures match the screen',
    steps: ['Export an auto-finance report'],
    expected: ['Every exported figure equals the on-screen value', 'The export names its branch and date range'],
  },

  // ────────────── X. Notifications & Approvals ──────────────
  {
    id: 'AUTO-530', area: 'Notifications & Approvals', priority: 'P1', automation: 'auto',
    title: 'A vehicle submitted by an agent notifies the approvers',
    steps: ['Submit a vehicle as A1'],
    expected: ['A notification reaches the branch admins naming the registration and the customer'],
  },
  {
    id: 'AUTO-531', area: 'Notifications & Approvals', priority: 'P1', automation: 'auto',
    title: 'Every approval request pairs with an approver notification',
    rules: ['X-23'],
    steps: ['Raise the approval requests the journey produces and count the notifications'],
    expected: ['At least one notification per request', 'No request sits silently in a queue nobody was told about'],
  },
  {
    id: 'AUTO-532', area: 'Notifications & Approvals', priority: 'P0', automation: 'auto',
    title: 'Notifications dispatch after commit, never inside the money transaction',
    rules: ['X-19'],
    steps: ['Force the origination transaction to roll back after the notify call site'],
    expected: ['No notification is delivered for a loan that was never created'],
  },
  {
    id: 'AUTO-533', area: 'Notifications & Approvals', priority: 'P1', automation: 'auto',
    title: 'A notification failure does not fail the money operation',
    steps: ['Make the transport throw and originate'],
    expected: ['The loan commits', 'The failure is logged, not surfaced as a 500'],
  },
  {
    id: 'AUTO-534', area: 'Notifications & Approvals', priority: 'P2', automation: 'auto',
    title: 'Notifications are branch-scoped',
    rules: ['SCOPE-3'],
    steps: ['Submit an Erode vehicle and read the HQ admin’s notifications'],
    expected: ['The HQ admin is not notified about Erode work'],
  },

  // ─────────────────── Y. Security & Negative ───────────────────
  {
    id: 'AUTO-550', area: 'Security & Negative', priority: 'P0', automation: 'auto',
    title: 'SQL-shaped payloads in vehicle fields are inert',
    steps: ['Create a vehicle whose model is "\'; DROP TABLE vehicles; --"'],
    expected: ['Stored literally', 'The table still exists'],
  },
  {
    id: 'AUTO-551', area: 'Security & Negative', priority: 'P0', automation: 'auto',
    title: 'Script payloads in text fields do not execute',
    steps: ['Store a script tag in the vehicle colour and open the registry'],
    expected: ['Rendered as text', 'No script runs on the staff screen'],
  },
  {
    id: 'AUTO-552', area: 'Security & Negative', priority: 'P0', automation: 'auto',
    title: 'No auto-finance response carries a password hash, token or secret',
    rules: ['X-13'],
    steps: ['Read the vehicle, loan, partner and dashboard payloads'],
    expected: ['No passwordHash, token or secret in any of them'],
  },
  {
    id: 'AUTO-553', area: 'Security & Negative', priority: 'P1', automation: 'auto',
    title: 'A vehicle id from another branch cannot be smuggled into an action',
    rules: ['SCOPE-3'],
    steps: ['Send the Erode vehicle id to the seize, release and patch routes while HQ is active'],
    expected: ['All refuse with 404', 'None writes a row'],
  },
  {
    id: 'AUTO-554', area: 'Security & Negative', priority: 'P1', automation: 'auto',
    title: 'Malformed JSON is refused cleanly',
    steps: ['POST "{" to each write route'],
    expected: ['A 4xx with a validation message', 'No stack trace and no 500'],
  },
  {
    id: 'AUTO-555', area: 'Security & Negative', priority: 'P1', automation: 'auto',
    title: 'A negative amount cannot reverse money through a receipt route',
    rules: ['X-14'],
    steps: ['Post an EMI receipt of −25000'],
    expected: ['Refused', 'No float and no instalment moves'],
  },
  {
    id: 'AUTO-556', area: 'Security & Negative', priority: 'P1', automation: 'auto',
    title: 'Extremely large numbers do not overflow the money columns',
    steps: ['Originate with a vehicle value of 1e308'],
    expected: ['Refused by validation', 'No Infinity is persisted'],
  },
  {
    id: 'AUTO-557', area: 'Security & Negative', priority: 'P2', automation: 'auto',
    title: 'Error messages do not disclose internals',
    steps: ['Trigger a failure on each write route'],
    expected: ['No Prisma code, table name or file path in any response'],
  },
  {
    id: 'AUTO-558', area: 'Security & Negative', priority: 'P2', automation: 'manual',
    title: 'An uploaded RC or insurance document rejects a disallowed type',
    steps: ['Upload an .exe as an RC document'],
    expected: ['Refused', 'No document row is created'],
  },

  // ────────────── Z. Concurrency & Performance ──────────────
  {
    id: 'AUTO-570', area: 'Concurrency & Performance', priority: 'P0', automation: 'auto',
    title: 'Two simultaneous originations of the same registration produce one vehicle',
    rules: ['AF-4'],
    steps: ['Fire two identical HP originations at once'],
    expected: ['One succeeds and one is refused with 409', 'Exactly one vehicle and one loan exist'],
  },
  {
    id: 'AUTO-571', area: 'Concurrency & Performance', priority: 'P0', automation: 'auto',
    title: 'Two simultaneous receipts on one loan do not double-apply',
    steps: ['Fire two receipts of 25000 with distinct idempotency keys'],
    expected: ['The instalments reflect 50000 exactly once', 'Two receipts with two distinct numbers'],
  },
  {
    id: 'AUTO-572', area: 'Concurrency & Performance', priority: 'P1', automation: 'auto',
    title: 'Two simultaneous seizures leave one open recovery',
    steps: ['Fire two seize calls at once'],
    expected: ['One succeeds, one is refused', 'One recovery row'],
  },
  {
    id: 'AUTO-573', area: 'Concurrency & Performance', priority: 'P1', automation: 'auto',
    title: 'Loan codes stay unique under concurrent origination',
    steps: ['Originate five loans simultaneously'],
    expected: ['Five distinct codes', 'No collision on the generated sequence'],
  },
  {
    id: 'AUTO-574', area: 'Concurrency & Performance', priority: 'P1', automation: 'auto',
    title: 'The registry list stays fast with a large book',
    steps: ['Seed 500 vehicles and open the registry'],
    expected: ['Paginated, not unbounded', 'No query fetches every loan of every vehicle'],
  },
  {
    id: 'AUTO-575', area: 'Concurrency & Performance', priority: 'P2', automation: 'auto',
    title: 'A long schedule does not slow the loan detail page',
    steps: ['Open an 84-month HP loan'],
    expected: ['The page renders within budget', 'The schedule is paged or virtualised rather than rendered whole'],
  },
];

/** Convenience counts used by the report builder and the coverage assertion. */
export const CASE_COUNT = CASES.length;
export const AUTOMATED_CASES = CASES.filter((c) => c.automation === 'auto');
export const MANUAL_CASES = CASES.filter((c) => c.automation === 'manual');
