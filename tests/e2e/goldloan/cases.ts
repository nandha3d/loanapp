/**
 * Gold Loan — master test-case catalogue.
 *
 * Single source of truth for both the Playwright specs and the HTML tracker.
 * A spec claims a case by putting its id in the test title: `test('[GL-101] …')`.
 *
 * The id prefix is GL- rather than GOLD-, because `GOLD-1`…`GOLD-4` are the
 * numbered RULES in ENGINEERING_REFERENCE §10.8 and a case id shaped like a
 * rule id makes every failure message ambiguous.
 *
 * Reference pledge, worked by hand from lib/gold/valuation.ts:
 *
 *   50g net of 22K gold, pure rate ₹7000/g, LTV 75%
 *     fineness       = 0.916                       (a physical constant)
 *     assessedValue  = 50 × 7000 × 0.916 = 320600
 *     eligibleAmount = 320600 × 75%      = 240450
 *
 * And from lib/gold/origination.ts — the RBI 2025 consumption tiers:
 *     ≤ ₹2.5L → 85%      ≤ ₹5L → 80%      above → 75%
 */

export type Automation = 'auto' | 'manual';
export type Priority = 'P0' | 'P1' | 'P2';

export type GoldCase = {
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
  'Karat & Fineness',
  'Valuation',
  'Ornament Lines',
  'LTV Tiers & Ceiling',
  'Origination Validation',
  'Policy Snapshot',
  'Collateral Requirement',
  'Pledge Interest — Full Month',
  'Pledge Interest — Prorated',
  'Servicing & Redemption',
  'Part Payment & Closure',
  'Repledge',
  'Rate Master & Settings',
  'Branch & Tenant Isolation',
  'RBAC',
  'Accounting & Float',
  'Security & Negative',
  'Concurrency & Reports',
] as const;

export const CASES: GoldCase[] = [
  // ───────────────────── A. Module Access & Gating ─────────────────────
  {
    id: 'GL-001', area: 'Module Access & Gating', priority: 'P0', automation: 'auto',
    title: 'Registering with goldloan selected entitles the tenant to the module',
    rules: ['SCOPE-4'],
    steps: ['Register a tenant with selectedModules ["goldloan"]'],
    expected: ['Tenant, owner and Head Office branch created', 'The subscription snapshot carries goldloan'],
  },
  {
    id: 'GL-002', area: 'Module Access & Gating', priority: 'P0', automation: 'auto',
    title: 'Gold pages load for an entitled tenant',
    rules: ['SCOPE-4'],
    steps: ['Log in as the owner and open the gold loan list'],
    expected: ['The page renders', 'No redirect to /portal or /dashboard'],
  },
  {
    id: 'GL-003', area: 'Module Access & Gating', priority: 'P0', automation: 'auto',
    title: 'A tenant without the module is refused the gold API',
    rules: ['SCOPE-4', 'ROLE-4'],
    steps: ['Call the gold rate and config routes with a token from a tenant that has no goldloan'],
    expected: ['Non-2xx, or empty', 'Never another tenant’s rate master'],
  },
  {
    id: 'GL-004', area: 'Module Access & Gating', priority: 'P1', automation: 'auto',
    title: 'Gold loans are stamped with appType goldloan',
    rules: ['SCOPE-1'],
    steps: ['Originate a pledge and read the row'],
    expected: ['appType is goldloan', 'The loan never appears under a microlending query'],
  },
  {
    id: 'GL-005', area: 'Module Access & Gating', priority: 'P2', automation: 'auto',
    title: 'Every gold endpoint refuses an unauthenticated caller',
    rules: ['ROLE-4', 'X-13'],
    steps: ['Call the gold rate, config, master and reports routes with no token'],
    expected: ['HTTP 401 on each', 'No rate or pledge data in any body'],
  },

  // ───────────────────────── B. Karat & Fineness ─────────────────────────
  {
    id: 'GL-020', area: 'Karat & Fineness', priority: 'P0', automation: 'auto',
    title: 'Each supported karat maps to its physical fineness',
    steps: ['Resolve the fineness for 24K, 23K, 22K, 21K, 20K, 18K, 14K and 10K'],
    expected: ['1.0, 0.958, 0.916, 0.875, 0.833, 0.75, 0.585 and 0.417 respectively', 'These are physical constants, not tunable business values'],
  },
  {
    id: 'GL-021', area: 'Karat & Fineness', priority: 'P1', automation: 'auto',
    title: 'Karat lookup ignores case and surrounding whitespace',
    steps: ['Resolve "  22k  " and "22K"'],
    expected: ['Both give 0.916', 'What an operator types with a stray space values the same as what they meant'],
  },
  {
    id: 'GL-022', area: 'Karat & Fineness', priority: 'P0', automation: 'auto',
    title: 'An unrecognised karat does not silently value as 22K',
    rules: ['GOLD-2'],
    pre: 'finenessFor falls back to the 22K constant for any key it does not know',
    steps: ['Resolve the fineness for "9K", then for "" and "gold"'],
    expected: ['The unknown purity is refused, or valued at its own fineness', 'A 9K ornament appraised at 22K over-values the pledge by more than half — the fallback must not be silent'],
  },
  {
    id: 'GL-023', area: 'Karat & Fineness', priority: 'P2', automation: 'auto',
    title: 'The karat table is not reachable from configuration',
    steps: ['Search for a settings key that overrides a fineness factor'],
    expected: ['None exists', 'Purity is physics; the rate and the LTV are the tunable parts'],
  },

  // ───────────────────────────── C. Valuation ─────────────────────────────
  {
    id: 'GL-035', area: 'Valuation', priority: 'P0', automation: 'auto',
    title: 'The reference pledge produces the worked figures',
    steps: ['Value 50g of 22K at ₹7000/g pure with LTV 75'],
    expected: ['assessedValue 320600', 'eligibleAmount 240450', 'finenessUsed 0.916'],
  },
  {
    id: 'GL-036', area: 'Valuation', priority: 'P0', automation: 'auto',
    title: 'The rate given is the rate for PURE gold, adjusted by purity',
    steps: ['Value 50g of 24K and 50g of 22K at the same ₹7000/g'],
    expected: ['24K values at 350000 and 22K at 320600', 'A 22K ornament is worth 91.6% of the pure-gold rate, never the full rate'],
  },
  {
    id: 'GL-037', area: 'Valuation', priority: 'P1', automation: 'auto',
    title: 'Assessed value scales linearly with weight',
    steps: ['Value 10g, 50g and 100g at the same rate and purity'],
    expected: ['64120, 320600 and 641200', 'No step, cap or discount is applied by weight'],
  },
  {
    id: 'GL-038', area: 'Valuation', priority: 'P1', automation: 'auto',
    title: 'A zero or negative weight values at zero rather than throwing',
    steps: ['Value 0g, then −10g'],
    expected: ['assessedValue 0 and eligibleAmount 0 for both', 'The calculator clamps rather than throwing — the form shows a zero, not a crash'],
  },
  {
    id: 'GL-039', area: 'Valuation', priority: 'P1', automation: 'auto',
    title: 'A zero or negative rate values at zero',
    steps: ['Value the reference at rate 0, then at −7000'],
    expected: ['assessedValue 0 for both'],
  },
  {
    id: 'GL-040', area: 'Valuation', priority: 'P0', automation: 'auto',
    title: 'The LTV percent is clamped to 0–100',
    steps: ['Value the reference at LTV 150, then at −20'],
    expected: ['150 clamps to 100, giving an eligible amount equal to the assessed value', '−20 clamps to 0', 'No configuration can lend more than the metal is worth'],
  },
  {
    id: 'GL-041', area: 'Valuation', priority: 'P1', automation: 'auto',
    title: 'Assessed value and eligible amount are whole rupees',
    steps: ['Value a weight that produces a fractional result'],
    expected: ['Both figures are integers', 'A pledge receipt never quotes paise on the appraisal'],
  },
  {
    id: 'GL-042', area: 'Valuation', priority: 'P2', automation: 'auto',
    title: 'A fractional weight is valued exactly',
    steps: ['Value 12.345g of 22K at ₹7000/g'],
    expected: ['The result matches weight × rate × fineness rounded once, with no accumulated drift'],
  },
  {
    id: 'GL-043', area: 'Valuation', priority: 'P2', automation: 'manual',
    title: 'The valuation shown on the form matches the one that is stored',
    steps: ['Fill the pledge form and submit'],
    expected: ['The appraisal on screen equals the appraisal on the loan row', 'The operator never signs a figure the system then changes'],
  },

  // ─────────────────────────── D. Ornament Lines ───────────────────────────
  {
    id: 'GL-055', area: 'Ornament Lines', priority: 'P0', automation: 'auto',
    title: 'Net weight is gross less wastage',
    rules: ['GOLD-2'],
    steps: ['Resolve a line of 12.5g gross with 0.5g wastage'],
    expected: ['netWeightGrams 12', 'value = 12 × the line rate'],
  },
  {
    id: 'GL-056', area: 'Ornament Lines', priority: 'P0', automation: 'auto',
    title: 'An explicit net weight overrides the derived one',
    rules: ['GOLD-2'],
    steps: ['Resolve a line of 12.5g gross, 0.5g wastage and an explicit net of 11g'],
    expected: ['netWeightGrams 11', 'The appraiser’s own measurement wins over the arithmetic'],
  },
  {
    id: 'GL-057', area: 'Ornament Lines', priority: 'P0', automation: 'auto',
    title: 'Wastage larger than the gross weight floors the net at zero',
    rules: ['GOLD-2'],
    steps: ['Resolve a line of 5g gross with 8g wastage'],
    expected: ['netWeightGrams 0 and value 0', 'A negative weight never reaches a valuation'],
  },
  {
    id: 'GL-058', area: 'Ornament Lines', priority: 'P0', automation: 'auto',
    title: 'Net weight must be positive and no greater than gross',
    rules: ['GOLD-2'],
    steps: ['Submit a pledge line whose net weight exceeds its gross weight'],
    expected: ['Refused', 'An ornament cannot contain more metal than it weighs'],
  },
  {
    id: 'GL-059', area: 'Ornament Lines', priority: 'P1', automation: 'auto',
    title: 'Both weights are required on every line',
    rules: ['GOLD-2'],
    steps: ['Submit a line with no gross weight, then one with no net'],
    expected: ['Both refused', 'A pledge with an unweighed ornament is not a pledge'],
  },
  {
    id: 'GL-060', area: 'Ornament Lines', priority: 'P1', automation: 'auto',
    title: 'Quantity defaults to one and is a whole number',
    steps: ['Resolve lines with no quantity, quantity 0, quantity 2.7 and quantity −1'],
    expected: ['All resolve to 1 except 2.7, which floors to 2', 'Half an ornament is not a thing'],
  },
  {
    id: 'GL-061', area: 'Ornament Lines', priority: 'P0', automation: 'auto',
    title: 'Header totals are the sum of the lines',
    rules: ['GOLD-2'],
    steps: ['Total three lines of differing weights and rates'],
    expected: ['Quantity, gross, wastage, net and value each sum across the lines', 'Weights are carried to three decimals, values to whole rupees'],
  },
  {
    id: 'GL-062', area: 'Ornament Lines', priority: 'P0', automation: 'auto',
    title: 'Itemised lines are authoritative over the header totals',
    rules: ['GOLD-2'],
    steps: ['Submit a pledge whose header net weight disagrees with the sum of its lines'],
    expected: ['The stored pledge follows the lines', 'A header figure typed by hand never overrides what was weighed'],
  },
  {
    id: 'GL-063', area: 'Ornament Lines', priority: 'P1', automation: 'auto',
    title: 'An empty line list totals to zero without throwing',
    steps: ['Total an empty list of ornaments'],
    expected: ['Every total is 0', 'The form renders a zero state rather than an error'],
  },
  {
    id: 'GL-064', area: 'Ornament Lines', priority: 'P2', automation: 'auto',
    title: 'Weight totals do not accumulate floating-point drift',
    steps: ['Total twenty lines of 0.001g each'],
    expected: ['The total reads 0.02 exactly', 'Three-decimal rounding is applied once at the total, not per line'],
  },
  {
    id: 'GL-065', area: 'Ornament Lines', priority: 'P2', automation: 'auto',
    title: 'Each line records its own rate',
    steps: ['Total two lines at different rates per gram'],
    expected: ['Each line values at its own rate', 'A mixed-purity pledge is not flattened to one rate'],
  },

  // ──────────────────── E. LTV Tiers & Ceiling ────────────────────
  {
    id: 'GL-080', area: 'LTV Tiers & Ceiling', priority: 'P0', automation: 'auto',
    title: 'A consumption loan up to ₹2.5L sits in the 85% tier',
    rules: ['GOLD-1'],
    steps: ['Resolve the maximum LTV for 100000, then for exactly 250000'],
    expected: ['85% for both — the boundary is inclusive'],
  },
  {
    id: 'GL-081', area: 'LTV Tiers & Ceiling', priority: 'P0', automation: 'auto',
    title: 'Above ₹2.5L and up to ₹5L the ceiling is 80%',
    rules: ['GOLD-1'],
    steps: ['Resolve the maximum LTV for 250001, then for exactly 500000'],
    expected: ['80% for both'],
  },
  {
    id: 'GL-082', area: 'LTV Tiers & Ceiling', priority: 'P0', automation: 'auto',
    title: 'Above ₹5L the ceiling is 75%',
    rules: ['GOLD-1'],
    steps: ['Resolve the maximum LTV for 500001 and for 2000000'],
    expected: ['75% for both'],
  },
  {
    id: 'GL-083', area: 'LTV Tiers & Ceiling', priority: 'P0', automation: 'auto',
    title: 'The tier is decided by the borrower’s TOTAL exposure, not this loan alone',
    rules: ['GOLD-1'],
    steps: ['Validate a 220000 bullet exposure with 400000 already outstanding'],
    expected: ['The combined 620000 lands in the 75% tier', 'A borrower cannot stay in the 85% tier by splitting one pledge into several'],
  },
  {
    id: 'GL-084', area: 'LTV Tiers & Ceiling', priority: 'P0', automation: 'auto',
    title: 'A requested LTV above the ceiling is clamped, never honoured',
    rules: ['GOLD-1'],
    steps: ['Validate with a requested LTV of 90 where the tier allows 85'],
    expected: ['appliedLtvPercent 85', 'A ceiling is never raised from configuration'],
  },
  {
    id: 'GL-085', area: 'LTV Tiers & Ceiling', priority: 'P1', automation: 'auto',
    title: 'A requested LTV below the ceiling is honoured',
    rules: ['GOLD-1'],
    steps: ['Validate with a requested LTV of 60 where the tier allows 85'],
    expected: ['appliedLtvPercent 60', 'A branch may lend more conservatively than the regulator requires'],
  },
  {
    id: 'GL-086', area: 'LTV Tiers & Ceiling', priority: 'P1', automation: 'auto',
    title: 'A zero or negative requested LTV is refused',
    rules: ['GOLD-1'],
    steps: ['Validate with a requested LTV of 0, then −5'],
    expected: ['Both refused with the LTV message'],
  },
  {
    id: 'GL-087', area: 'LTV Tiers & Ceiling', priority: 'P0', automation: 'auto',
    title: 'A bullet pledge is measured on what is repayable at maturity',
    rules: ['GOLD-1'],
    steps: ['Validate a bullet pledge of 200000 principal repaying 220000'],
    expected: ['exposureForLtv 220000, not 200000', 'The interest a bullet accrues is part of the exposure the collateral must cover'],
  },
  {
    id: 'GL-088', area: 'LTV Tiers & Ceiling', priority: 'P0', automation: 'auto',
    title: 'An amortising pledge is measured on principal',
    rules: ['GOLD-1'],
    steps: ['Validate the same figures as an amortising product'],
    expected: ['exposureForLtv 200000', 'A reducing balance is not the same risk as a bullet'],
  },
  {
    id: 'GL-089', area: 'LTV Tiers & Ceiling', priority: 'P0', automation: 'auto',
    title: 'An exposure above the eligible amount is refused with both figures',
    rules: ['GOLD-1'],
    steps: ['Validate a 330000 bullet exposure against a 320600 appraisal'],
    expected: ['Refused, naming the exposure and the eligible amount', 'The operator can see the gap without doing the arithmetic'],
  },
  {
    id: 'GL-090', area: 'LTV Tiers & Ceiling', priority: 'P1', automation: 'auto',
    title: 'Exposure exactly at the eligible amount is accepted',
    rules: ['GOLD-1'],
    steps: ['Validate an exposure equal to assessedValue × appliedLtv'],
    expected: ['Accepted — the ceiling is inclusive'],
  },
  {
    id: 'GL-091', area: 'LTV Tiers & Ceiling', priority: 'P1', automation: 'auto',
    title: 'The eligible amount rounds DOWN to the paisa',
    rules: ['GOLD-1'],
    steps: ['Validate an appraisal whose LTV product carries a fraction'],
    expected: ['The eligible amount never rounds up', 'Rounding up would sanction a rupee the ceiling does not allow'],
  },
  {
    id: 'GL-092', area: 'LTV Tiers & Ceiling', priority: 'P1', automation: 'auto',
    title: 'A negative existing exposure is floored at zero',
    rules: ['GOLD-1'],
    steps: ['Validate with an existing exposure of −100000'],
    expected: ['Treated as zero', 'A negative cannot be used to buy headroom under the ceiling'],
  },
  {
    id: 'GL-093', area: 'LTV Tiers & Ceiling', priority: 'P0', automation: 'auto',
    title: 'Exposure is recomputed inside the transaction, not trusted from the request',
    rules: ['GOLD-1'],
    steps: ['Originate a second pledge for a borrower who already holds one, claiming zero existing exposure'],
    expected: ['The server reads the borrower’s live active and pending gold loans', 'The claimed figure is ignored'],
  },

  // ─────────────────── F. Origination Validation ───────────────────
  {
    id: 'GL-110', area: 'Origination Validation', priority: 'P0', automation: 'auto',
    title: 'A zero or negative assessed value is refused',
    steps: ['Validate with an assessed value of 0, then −1'],
    expected: ['Refused with "Assessed collateral value must be greater than zero."'],
  },
  {
    id: 'GL-111', area: 'Origination Validation', priority: 'P0', automation: 'auto',
    title: 'A zero or negative principal is refused',
    steps: ['Validate with a requested principal of 0, then −1'],
    expected: ['Refused with the principal message'],
  },
  {
    id: 'GL-112', area: 'Origination Validation', priority: 'P0', automation: 'auto',
    title: 'A zero total payable is refused',
    steps: ['Validate with a total payable at maturity of 0'],
    expected: ['Refused', 'A pledge that repays nothing is not a loan'],
  },
  {
    id: 'GL-113', area: 'Origination Validation', priority: 'P1', automation: 'auto',
    title: 'A non-numeric money field is refused, not coerced',
    steps: ['Validate with an assessed value of "three lakh"'],
    expected: ['Refused rather than treated as zero'],
  },
  {
    id: 'GL-114', area: 'Origination Validation', priority: 'P1', automation: 'auto',
    title: 'Every validation refusal surfaces as a 400 through the API',
    rules: ['API-4'],
    steps: ['Send each invalid pledge through the origination route'],
    expected: ['HTTP 400 with the validator’s own message', 'Never a 500'],
  },
  {
    id: 'GL-115', area: 'Origination Validation', priority: 'P0', automation: 'auto',
    title: 'The persisted loan carries the validated figures, not the claimed ones',
    rules: ['GOLD-1', 'GOLD-4'],
    steps: ['Originate claiming an LTV and an eligible amount that flatter the borrower'],
    expected: ['The stored loan carries what validateGoldOrigination returned'],
  },

  // ─────────────────────── G. Policy Snapshot ───────────────────────
  {
    id: 'GL-130', area: 'Policy Snapshot', priority: 'P0', automation: 'auto',
    title: 'The applied policy is snapshotted on the loan and the collateral',
    rules: ['GOLD-4'],
    steps: ['Originate a pledge and read both rows'],
    expected: ['Both carry the policy id RBI_GOLD_SILVER_2025_V1', 'Both carry maximumLtvPercent, appliedLtvPercent and exposureForLtv'],
  },
  {
    id: 'GL-131', area: 'Policy Snapshot', priority: 'P0', automation: 'auto',
    title: 'A later rate movement never restates an originated pledge',
    rules: ['GOLD-4'],
    steps: ['Originate at ₹7000/g, change the rate setting to ₹6000/g, re-read the loan'],
    expected: ['The appraisal, the eligible amount and the applied LTV are unchanged', 'A pledge is priced on the day it was made'],
  },
  {
    id: 'GL-132', area: 'Policy Snapshot', priority: 'P1', automation: 'auto',
    title: 'The snapshot survives a repledge as its own record',
    rules: ['GOLD-4'],
    steps: ['Repledge an existing pledge at a new rate'],
    expected: ['The new pledge carries its own snapshot', 'The original snapshot is not overwritten'],
  },
  {
    id: 'GL-133', area: 'Policy Snapshot', priority: 'P1', automation: 'auto',
    title: 'The snapshot records the tier that was applied, not just the requested LTV',
    rules: ['GOLD-4'],
    steps: ['Originate where the request asked for 90 and the tier allowed 85'],
    expected: ['maximumLtvPercent 85 and appliedLtvPercent 85 are both stored', 'An auditor can see the ceiling that bound the decision'],
  },

  // ─────────────────── H. Collateral Requirement ───────────────────
  {
    id: 'GL-145', area: 'Collateral Requirement', priority: 'P0', automation: 'auto',
    title: 'A goldloan origination without collateral is refused outright',
    rules: ['GOLD-3'],
    steps: ['POST a goldloan origination with no ornament lines and no collateral block'],
    expected: ['Refused', 'Collateral is not optional for this module'],
  },
  {
    id: 'GL-146', area: 'Collateral Requirement', priority: 'P0', automation: 'auto',
    title: 'The collateral row is written in the same transaction as the loan',
    rules: ['GOLD-3', 'DB-8'],
    steps: ['Force the collateral insert to fail'],
    expected: ['No loan, no schedule and no collateral survive'],
  },
  {
    id: 'GL-147', area: 'Collateral Requirement', priority: 'P1', automation: 'auto',
    title: 'Collateral cannot be detached from a live pledge',
    steps: ['Attempt to delete the collateral of an active gold loan'],
    expected: ['Refused', 'An unsecured gold loan is a contradiction'],
  },
  {
    id: 'GL-148', area: 'Collateral Requirement', priority: 'P1', automation: 'auto',
    title: 'Another module may originate without gold collateral',
    rules: ['GOLD-3'],
    steps: ['Originate a micro-lending loan with no collateral'],
    expected: ['Accepted', 'The requirement is scoped to the goldloan module, not applied globally'],
  },

  // ────────────── I. Pledge Interest — Full Month ──────────────
  {
    id: 'GL-160', area: 'Pledge Interest — Full Month', priority: 'P0', automation: 'auto',
    title: 'A partial month is billed as a full month',
    pre: 'The competitor behaviour this mirrors: one month of interest for 23 days',
    steps: ['Charge a 200000 pledge at 2% a month from 1 Jan to 24 Jan'],
    expected: ['months 0, extraDays 23, monthsCharged 1', 'interestDue 4000 — a full month'],
  },
  {
    id: 'GL-161', area: 'Pledge Interest — Full Month', priority: 'P0', automation: 'auto',
    title: 'A brand-new pledge still owes its first month',
    steps: ['Charge the reference pledge from a date to that same date'],
    expected: ['months 0, extraDays 0, monthsCharged 1', 'interestDue 4000 — the first month is earned on the day the metal is taken in'],
  },
  {
    id: 'GL-162', area: 'Pledge Interest — Full Month', priority: 'P0', automation: 'auto',
    title: 'Exact whole months are not rounded up',
    steps: ['Charge from 1 Jan to 1 Mar'],
    expected: ['months 2, extraDays 0, monthsCharged 2', 'interestDue 8000 — nobody pays a third month for a two-month pledge'],
  },
  {
    id: 'GL-163', area: 'Pledge Interest — Full Month', priority: 'P0', automation: 'auto',
    title: 'Whole months plus a day bills the extra month',
    steps: ['Charge from 1 Jan to 2 Mar'],
    expected: ['months 2, extraDays 1, monthsCharged 3', 'interestDue 12000'],
  },
  {
    id: 'GL-164', area: 'Pledge Interest — Full Month', priority: 'P1', automation: 'auto',
    title: 'The month boundary is anchored on the pledge day, not the calendar',
    steps: ['Charge from 15 Jan to 14 Feb, then to 15 Feb'],
    expected: ['The first is 0 months and 30 days; the second is exactly 1 month', 'A pledge taken mid-month runs mid-month to mid-month'],
  },
  {
    id: 'GL-165', area: 'Pledge Interest — Full Month', priority: 'P1', automation: 'auto',
    title: 'A month-end pledge does not gain or lose a month in February',
    steps: ['Charge from 31 Jan to 28 Feb, then to 1 Mar'],
    expected: ['The elapsed period is reported honestly for both', 'A short month does not silently add a billable month'],
  },
  {
    id: 'GL-166', area: 'Pledge Interest — Full Month', priority: 'P1', automation: 'auto',
    title: 'A backwards period charges nothing rather than throwing',
    steps: ['Charge from 1 Mar to 1 Jan'],
    expected: ['months 0 and extraDays 0', 'A clock skew never produces a negative bill'],
  },
  {
    id: 'GL-167', area: 'Pledge Interest — Full Month', priority: 'P0', automation: 'auto',
    title: 'The monthly interest is the rate applied to the principal',
    steps: ['Charge 200000 at 2%, then at 0%, then at 1.5%'],
    expected: ['4000, 0 and 3000 a month', 'The rate is per month, not per annum'],
  },
  {
    id: 'GL-168', area: 'Pledge Interest — Full Month', priority: 'P1', automation: 'auto',
    title: 'A zero or negative principal owes no interest',
    steps: ['Charge 0, then −200000'],
    expected: ['monthlyInterest 0 and interestDue 0 for both'],
  },
  {
    id: 'GL-169', area: 'Pledge Interest — Full Month', priority: 'P2', automation: 'auto',
    title: 'Interest is quoted in whole rupees',
    steps: ['Charge a principal and rate that produce a fraction'],
    expected: ['Both the monthly figure and the total are integers'],
  },

  // ────────────── J. Pledge Interest — Prorated ──────────────
  {
    id: 'GL-180', area: 'Pledge Interest — Prorated', priority: 'P0', automation: 'auto',
    title: 'Prorated billing charges the part month as a fraction',
    steps: ['Charge the reference from 1 Jan to 16 Mar under the prorated rule'],
    expected: ['monthsCharged 2.5 (two months and fifteen days)', 'interestDue 10000'],
  },
  {
    id: 'GL-181', area: 'Pledge Interest — Prorated', priority: 'P0', automation: 'auto',
    title: 'The two rules disagree by design, and the setting decides which applies',
    steps: ['Charge the same 23-day period under both rules'],
    expected: ['full charges a whole month; prorated charges 23/30 of one', 'The rounding rule is configurable, so an admin changes behaviour, not a developer'],
  },
  {
    id: 'GL-182', area: 'Pledge Interest — Prorated', priority: 'P1', automation: 'auto',
    title: 'A prorated brand-new pledge owes nothing yet',
    steps: ['Charge from a date to that same date under the prorated rule'],
    expected: ['monthsCharged 0 and interestDue 0', 'Unlike the full-month rule, proration earns interest only as time passes'],
  },
  {
    id: 'GL-183', area: 'Pledge Interest — Prorated', priority: 'P1', automation: 'auto',
    title: 'Proration uses a thirty-day month',
    steps: ['Charge 15 extra days, then 30 extra days'],
    expected: ['0.5 and 1.0 of a month respectively'],
  },
  {
    id: 'GL-184', area: 'Pledge Interest — Prorated', priority: 'P2', automation: 'auto',
    title: 'The prorated total is still rounded to whole rupees',
    steps: ['Charge a period whose prorated interest carries a fraction'],
    expected: ['The stored interest is an integer'],
  },

  // ─────────────── K. Servicing & Redemption ───────────────
  {
    id: 'GL-200', area: 'Servicing & Redemption', priority: 'P0', automation: 'auto',
    title: 'The servicing summary reports what the pledge owes right now',
    steps: ['Summarise a 200000 pledge at 2% paid up to 1 Jan, valued on 24 Jan'],
    expected: ['monthlyInterest 4000, monthsDue 1, interestDue 4000', 'redemptionAmount 204000'],
  },
  {
    id: 'GL-201', area: 'Servicing & Redemption', priority: 'P0', automation: 'auto',
    title: 'The redemption amount is principal plus interest plus penalty',
    steps: ['Summarise with a 1500 penalty outstanding'],
    expected: ['redemptionAmount 205500', 'Each head is reported separately as well as summed'],
  },
  {
    id: 'GL-202', area: 'Servicing & Redemption', priority: 'P1', automation: 'auto',
    title: 'A negative penalty or principal never reduces the redemption below its parts',
    steps: ['Summarise with a penalty of −5000 and again with a principal of −1000'],
    expected: ['Each negative is floored at zero', 'A redemption quote cannot be talked down by a negative input'],
  },
  {
    id: 'GL-203', area: 'Servicing & Redemption', priority: 'P0', automation: 'auto',
    title: 'Servicing never recomputes money at the call site',
    steps: ['Compare the API servicing response against computeServicing for the same inputs'],
    expected: ['Identical figures', 'The route reads the helper rather than doing its own arithmetic'],
  },
  {
    id: 'GL-204', area: 'Servicing & Redemption', priority: 'P1', automation: 'auto',
    title: 'An interest payment covers whole and fractional months',
    steps: ['Apply 12000 against a 4000 monthly interest, then 6000'],
    expected: ['3 months and 1.5 months respectively'],
  },
  {
    id: 'GL-205', area: 'Servicing & Redemption', priority: 'P1', automation: 'auto',
    title: 'A payment against a zero monthly interest covers nothing',
    steps: ['Apply 12000 where the monthly interest is 0'],
    expected: ['0 months covered', 'No division by zero'],
  },
  {
    id: 'GL-206', area: 'Servicing & Redemption', priority: 'P0', automation: 'auto',
    title: 'The interest-paid-upto date advances by the months a payment covered',
    steps: ['Advance 1 Jan by 1 month, then by 1.5 months'],
    expected: ['1 Feb, and 16 Feb', 'A fractional month advances by roughly thirty days'],
  },
  {
    id: 'GL-207', area: 'Servicing & Redemption', priority: 'P0', automation: 'auto',
    title: 'Advancing a month-end date does not skip a month',
    pre: 'advanceByMonths uses setMonth with no day clamping, and setMonth overflows a short month',
    steps: ['Advance 31 January by one month'],
    expected: ['28 February (or 29 in a leap year), never 3 March', 'A pledge anchored to a month end must not lose February every year it runs'],
  },
  {
    id: 'GL-208', area: 'Servicing & Redemption', priority: 'P1', automation: 'auto',
    title: 'Paying interest twice in one day does not advance the date twice',
    rules: ['DB-11'],
    steps: ['Post the same interest receipt twice'],
    expected: ['The paid-upto date moves once', 'One receipt, one advance'],
  },
  {
    id: 'GL-209', area: 'Servicing & Redemption', priority: 'P1', automation: 'auto',
    title: 'A cash interest payment moves float; a UPI one does not',
    rules: ['MONEY-17'],
    steps: ['Post an interest receipt in cash, then in UPI'],
    expected: ['The cash leg credits the collecting float and the cash book', 'The UPI leg reaches the books but not the drawer'],
  },

  // ─────────────── L. Part Payment & Closure ───────────────
  {
    id: 'GL-220', area: 'Part Payment & Closure', priority: 'P0', automation: 'auto',
    title: 'A part payment reduces the outstanding principal',
    steps: ['Apply 50000 against a 200000 pledge'],
    expected: ['Outstanding 150000', 'Interest from that point is charged on the reduced principal'],
  },
  {
    id: 'GL-221', area: 'Part Payment & Closure', priority: 'P0', automation: 'auto',
    title: 'A part payment never drives the principal below zero',
    steps: ['Apply 250000 against a 200000 pledge'],
    expected: ['Outstanding 0, not −50000', 'The excess is surfaced as an advance or refused, never as a negative balance'],
  },
  {
    id: 'GL-222', area: 'Part Payment & Closure', priority: 'P1', automation: 'auto',
    title: 'A zero or negative part payment changes nothing',
    steps: ['Apply 0, then −50000'],
    expected: ['The outstanding is unchanged in both cases'],
  },
  {
    id: 'GL-223', area: 'Part Payment & Closure', priority: 'P0', automation: 'auto',
    title: 'Redeeming in full closes the pledge and releases the ornaments',
    steps: ['Pay the quoted redemption amount'],
    expected: ['Loan closed', 'The collateral is marked released with its date and the releasing officer', 'The closure is audited'],
  },
  {
    id: 'GL-224', area: 'Part Payment & Closure', priority: 'P0', automation: 'auto',
    title: 'A short redemption does not release the ornaments',
    steps: ['Pay one rupee less than the quote'],
    expected: ['The pledge stays open and the collateral stays held', 'Metal is not returned for less than the debt without an explicit waiver'],
  },
  {
    id: 'GL-225', area: 'Part Payment & Closure', priority: 'P1', automation: 'auto',
    title: 'A released pledge cannot be redeemed again',
    steps: ['Redeem a closed pledge'],
    expected: ['Refused', 'No second receipt and no second release'],
  },
  {
    id: 'GL-226', area: 'Part Payment & Closure', priority: 'P1', automation: 'auto',
    title: 'Closure posts to the cash book and the GL',
    rules: ['ACC-6'],
    steps: ['Redeem and read the accounting rows'],
    expected: ['Principal and interest are posted to their own heads', 'The journal balances'],
  },

  // ──────────────────────── M. Repledge ────────────────────────
  {
    id: 'GL-240', area: 'Repledge', priority: 'P0', automation: 'auto',
    title: 'A repledge settles the old pledge and opens a new one',
    steps: ['Repledge an active pledge at the current rate'],
    expected: ['The original is closed with a repledge closure type', 'The new pledge carries the same ornaments and its own appraisal'],
  },
  {
    id: 'GL-241', area: 'Repledge', priority: 'P0', automation: 'auto',
    title: 'A repledge is re-validated against the LTV ceiling',
    rules: ['GOLD-1'],
    steps: ['Repledge for more than the current tier allows'],
    expected: ['Refused', 'A repledge is a new sanction, not a renewal that inherits an old ceiling'],
  },
  {
    id: 'GL-242', area: 'Repledge', priority: 'P0', automation: 'auto',
    title: 'The borrower’s other pledges count toward the repledge tier',
    rules: ['GOLD-1'],
    steps: ['Repledge for a borrower holding a second active gold loan'],
    expected: ['The combined exposure decides the tier'],
  },
  {
    id: 'GL-243', area: 'Repledge', priority: 'P1', automation: 'auto',
    title: 'Interest owed to the moment of repledge is settled or carried explicitly',
    steps: ['Repledge a pledge carrying two months of unpaid interest'],
    expected: ['The interest is either collected or added to the new principal, and which one is recorded', 'It is never dropped'],
  },
  {
    id: 'GL-244', area: 'Repledge', priority: 'P1', automation: 'auto',
    title: 'A repledge is atomic',
    rules: ['DB-8'],
    steps: ['Force the new-pledge insert to fail'],
    expected: ['The original pledge is still open and still holds its collateral'],
  },
  {
    id: 'GL-245', area: 'Repledge', priority: 'P1', automation: 'auto',
    title: 'A closed pledge cannot be repledged',
    steps: ['Repledge a redeemed pledge'],
    expected: ['Refused'],
  },

  // ─────────────── N. Rate Master & Settings ───────────────
  {
    id: 'GL-260', area: 'Rate Master & Settings', priority: 'P0', automation: 'auto',
    title: 'The pure-gold rate comes from settings, never from code',
    steps: ['Read the gold config for a tenant with no rate configured'],
    expected: ['The rate reads as unset rather than defaulting to a hardcoded market price', 'A pledge cannot be valued until an admin has entered a rate'],
  },
  {
    id: 'GL-261', area: 'Rate Master & Settings', priority: 'P0', automation: 'auto',
    title: 'Each tenant reads its own rate',
    rules: ['SCOPE-1'],
    steps: ['Set different rates on two tenants and read both configs'],
    expected: ['Each sees only its own', 'One office’s rate never values another office’s metal'],
  },
  {
    id: 'GL-262', area: 'Rate Master & Settings', priority: 'P1', automation: 'auto',
    title: 'A non-numeric rate reads as unset rather than as zero',
    steps: ['Store "seven thousand" as the rate and read the config'],
    expected: ['The rate is null', 'A zero rate would appraise every pledge at nothing and lend nothing, silently'],
  },
  {
    id: 'GL-263', area: 'Rate Master & Settings', priority: 'P1', automation: 'auto',
    title: 'Changing the rate takes effect on the next valuation, not on stored ones',
    rules: ['GOLD-4'],
    steps: ['Value a pledge, change the rate, value a new pledge'],
    expected: ['The new pledge uses the new rate', 'The stored one is untouched'],
  },
  {
    id: 'GL-264', area: 'Rate Master & Settings', priority: 'P1', automation: 'auto',
    title: 'The default LTV is a setting, and the ceiling still binds it',
    rules: ['GOLD-1'],
    steps: ['Set the default LTV to 95 and originate'],
    expected: ['The applied LTV is the regulatory ceiling, not 95', 'Configuration can lower the LTV, never raise it'],
  },
  {
    id: 'GL-265', area: 'Rate Master & Settings', priority: 'P1', automation: 'auto',
    title: 'Only an admin or above can change a rate',
    rules: ['ROLE-4'],
    steps: ['Update the gold rate as an agent'],
    expected: ['Refused server-side', 'The number that prices every pledge is not a field-editable one'],
  },
  {
    id: 'GL-266', area: 'Rate Master & Settings', priority: 'P2', automation: 'auto',
    title: 'A rate change is audited with its actor and its previous value',
    steps: ['Change the rate and read the audit trail'],
    expected: ['Old and new values are both recorded with who changed them'],
  },
  {
    id: 'GL-267', area: 'Rate Master & Settings', priority: 'P2', automation: 'auto',
    title: 'Field visibility hides a field without changing what is stored',
    steps: ['Hide a field through gold_field_visibility and read a pledge'],
    expected: ['The field is absent from the form but its stored value is untouched'],
  },
  {
    id: 'GL-268', area: 'Rate Master & Settings', priority: 'P2', automation: 'auto',
    title: 'The silver rate and the gold rate are separate settings',
    steps: ['Set only the gold rate and read the config'],
    expected: ['The silver rate stays unset', 'One metal’s price never stands in for another’s'],
  },

  // ────────── O. Branch & Tenant Isolation ──────────
  {
    id: 'GL-280', area: 'Branch & Tenant Isolation', priority: 'P0', automation: 'auto',
    title: 'The pledge list is branch-scoped',
    rules: ['SCOPE-3'],
    steps: ['List gold loans as an HQ admin with an Erode pledge present'],
    expected: ['Only HQ pledges', 'A superadmin across branches sees both'],
  },
  {
    id: 'GL-281', area: 'Branch & Tenant Isolation', priority: 'P0', automation: 'auto',
    title: 'A pledge id from another tenant returns 404, not 403',
    rules: ['API-5', 'X-12'],
    steps: ['Read a tenant-B gold loan with a tenant-A token'],
    expected: ['HTTP 404 — existence is not confirmed'],
  },
  {
    id: 'GL-282', area: 'Branch & Tenant Isolation', priority: 'P0', automation: 'auto',
    title: 'Servicing and redemption refuse a pledge from another branch',
    rules: ['SCOPE-3'],
    steps: ['Call servicing and redemption on the Erode pledge while HQ is active'],
    expected: ['Both return 404', 'The Erode ledger and cash position are untouched'],
  },
  {
    id: 'GL-283', area: 'Branch & Tenant Isolation', priority: 'P1', automation: 'auto',
    title: 'Money lands in the branch that owns the pledge',
    rules: ['SCOPE-3', 'MONEY-17'],
    steps: ['Collect interest on an Erode pledge while HQ is the active branch'],
    expected: ['The Erode pool moves, not HQ'],
  },
  {
    id: 'GL-284', area: 'Branch & Tenant Isolation', priority: 'P1', automation: 'auto',
    title: 'Gold postings carry the goldloan appType',
    rules: ['SCOPE-1'],
    steps: ['Read the account entries the journey created'],
    expected: ['Every entry is stamped goldloan', 'None appears in another module’s ledger'],
  },
  {
    id: 'GL-285', area: 'Branch & Tenant Isolation', priority: 'P1', automation: 'auto',
    title: 'A soft-deleted pledge disappears from lists and reports',
    rules: ['DB-4'],
    steps: ['Soft-delete a pledge and re-read the list and the reports'],
    expected: ['It is gone from both', 'Its receipts survive in the ledger'],
  },

  // ──────────────────────────── P. RBAC ────────────────────────────
  {
    id: 'GL-300', area: 'RBAC', priority: 'P0', automation: 'auto',
    title: 'An agent cannot originate a pledge without the bypass flag',
    rules: ['ROLE-5'],
    steps: ['Originate as an agent with bypassLoanApproval false'],
    expected: ['Held for approval rather than going live'],
  },
  {
    id: 'GL-301', area: 'RBAC', priority: 'P0', automation: 'auto',
    title: 'An agent cannot release collateral',
    rules: ['ROLE-4'],
    steps: ['Attempt a release as an agent'],
    expected: ['Refused server-side', 'Handing back the metal is not a field decision'],
  },
  {
    id: 'GL-302', area: 'RBAC', priority: 'P0', automation: 'auto',
    title: 'An agent cannot reach analytics, reports or settings',
    rules: ['ROLE-4'],
    steps: ['Request each blocked page and its API as an agent'],
    expected: ['Every handler refuses, not merely the nav'],
  },
  {
    id: 'GL-303', area: 'RBAC', priority: 'P1', automation: 'auto',
    title: 'A deactivated staff account cannot authenticate',
    rules: ['AUTH-4'],
    steps: ['Deactivate a user and attempt web and API login'],
    expected: ['Both refused'],
  },
  {
    id: 'GL-304', area: 'RBAC', priority: 'P1', automation: 'auto',
    title: 'A discount or waiver on redemption needs approval',
    rules: ['ROLE-4'],
    steps: ['Redeem with an interest waiver as a branch admin'],
    expected: ['Either refused or routed to an approver', 'Waiving interest on a secured loan is never a silent single click'],
  },

  // ─────────────────── Q. Accounting & Float ───────────────────
  {
    id: 'GL-320', area: 'Accounting & Float', priority: 'P0', automation: 'auto',
    title: 'A cash disbursement debits the branch pool',
    rules: ['MONEY-17'],
    steps: ['Originate a pledge with a cash payout and read the pool'],
    expected: ['The pool falls by the disbursed amount', 'A wallet transaction records it'],
  },
  {
    id: 'GL-321', area: 'Accounting & Float', priority: 'P0', automation: 'auto',
    title: 'A bank disbursement does not move physical cash',
    rules: ['MONEY-17'],
    steps: ['Originate with a bank payout'],
    expected: ['The GL records the disbursement', 'The cash pool is unchanged'],
  },
  {
    id: 'GL-322', area: 'Accounting & Float', priority: 'P0', automation: 'auto',
    title: 'A disbursement larger than the pool is refused, not overdrawn',
    rules: ['MONEY-16', 'X-14'],
    steps: ['Attempt a cash payout above the pool balance'],
    expected: ['Refused as insufficient float with a 409', 'No pledge, no collateral row and no schedule are left behind'],
  },
  {
    id: 'GL-323', area: 'Accounting & Float', priority: 'P1', automation: 'auto',
    title: 'Interest and principal post to their own heads',
    rules: ['ACC-6'],
    steps: ['Collect interest, then redeem, and read the entries'],
    expected: ['Interest income and principal recovery are separate entries', 'The journal balances after each'],
  },
  {
    id: 'GL-324', area: 'Accounting & Float', priority: 'P1', automation: 'auto',
    title: 'A locked accounting period refuses a backdated pledge posting',
    steps: ['Lock the period and post a receipt dated inside it'],
    expected: ['Refused with a period-lock conflict'],
  },
  {
    id: 'GL-325', area: 'Accounting & Float', priority: 'P1', automation: 'auto',
    title: 'Float never goes negative anywhere in the journey',
    rules: ['MONEY-16'],
    steps: ['Read every branch pool and agent float at the end of the run'],
    expected: ['Every balance is zero or above'],
  },

  // ─────────────────── R. Security & Negative ───────────────────
  {
    id: 'GL-340', area: 'Security & Negative', priority: 'P0', automation: 'auto',
    title: 'SQL-shaped payloads in ornament descriptions are inert',
    steps: ['Store a drop-table string as an ornament description'],
    expected: ['Stored literally', 'The table still exists'],
  },
  {
    id: 'GL-341', area: 'Security & Negative', priority: 'P0', automation: 'auto',
    title: 'Script payloads in text fields do not execute',
    steps: ['Store a script tag in an ornament description and open the pledge'],
    expected: ['Rendered as text on the staff screen'],
  },
  {
    id: 'GL-342', area: 'Security & Negative', priority: 'P0', automation: 'auto',
    title: 'No gold response carries a password hash, token or secret',
    rules: ['X-13'],
    steps: ['Read the pledge, collateral, rate and report payloads'],
    expected: ['None of them carries a hash, token or secret'],
  },
  {
    id: 'GL-343', area: 'Security & Negative', priority: 'P1', automation: 'auto',
    title: 'A negative amount cannot reverse money through a receipt route',
    rules: ['X-14'],
    steps: ['Post an interest receipt of a negative amount'],
    expected: ['Refused', 'No float and no ledger row moves'],
  },
  {
    id: 'GL-344', area: 'Security & Negative', priority: 'P1', automation: 'auto',
    title: 'Extremely large weights or rates do not overflow the money columns',
    steps: ['Value a pledge at 1e308 grams, then at 1e308 per gram'],
    expected: ['Refused by validation, or clamped', 'No Infinity is persisted'],
  },
  {
    id: 'GL-345', area: 'Security & Negative', priority: 'P1', automation: 'auto',
    title: 'Malformed JSON is refused cleanly',
    steps: ['POST a broken body to each gold write route'],
    expected: ['A 4xx with a validation message', 'No stack trace and no 500'],
  },
  {
    id: 'GL-346', area: 'Security & Negative', priority: 'P2', automation: 'auto',
    title: 'Error messages do not disclose internals',
    steps: ['Trigger a failure on each gold write route'],
    expected: ['No Prisma code, table name or file path in any response'],
  },
  {
    id: 'GL-347', area: 'Security & Negative', priority: 'P2', automation: 'manual',
    title: 'An ornament photo upload rejects a disallowed type',
    steps: ['Upload an .exe as an ornament photo'],
    expected: ['Refused', 'No document row is created'],
  },

  // ────────────── S. Concurrency & Reports ──────────────
  {
    id: 'GL-360', area: 'Concurrency & Reports', priority: 'P0', automation: 'auto',
    title: 'Two simultaneous originations for one borrower both respect the ceiling',
    rules: ['GOLD-1'],
    steps: ['Fire two pledges at once that individually fit the tier but together exceed it'],
    expected: ['The combined exposure is enforced', 'The ceiling is re-validated inside the transaction, so the second is refused'],
  },
  {
    id: 'GL-361', area: 'Concurrency & Reports', priority: 'P0', automation: 'auto',
    title: 'Two simultaneous redemptions release the metal once',
    steps: ['Fire two redemptions at once'],
    expected: ['One succeeds and one is refused', 'One release record, one set of postings'],
  },
  {
    id: 'GL-362', area: 'Concurrency & Reports', priority: 'P1', automation: 'auto',
    title: 'Two simultaneous interest receipts do not double-advance the paid-upto date',
    rules: ['DB-11'],
    steps: ['Fire two interest receipts at once'],
    expected: ['The date advances by what was actually collected, once'],
  },
  {
    id: 'GL-363', area: 'Concurrency & Reports', priority: 'P1', automation: 'auto',
    title: 'The pledge report totals match the underlying rows',
    steps: ['Run the gold report after a known set of pledges and redemptions'],
    expected: ['Outstanding principal, held weight and accrued interest match the rows'],
  },
  {
    id: 'GL-364', area: 'Concurrency & Reports', priority: 'P1', automation: 'auto',
    title: 'The held-weight total matches the sum of unreleased collateral',
    steps: ['Redeem one of three pledges and re-run the report'],
    expected: ['The released ornaments leave the held-weight total', 'The vault figure is one an auditor could weigh'],
  },
  {
    id: 'GL-365', area: 'Concurrency & Reports', priority: 'P2', automation: 'auto',
    title: 'Reports are branch-scoped and closed to agents',
    rules: ['SCOPE-3', 'ROLE-4'],
    steps: ['Run the gold report under each branch, then as an agent'],
    expected: ['Each branch sees only its own', 'The agent is refused by the handler'],
  },
  {
    id: 'GL-366', area: 'Concurrency & Reports', priority: 'P2', automation: 'auto',
    title: 'An empty branch reports zeroes, not errors',
    steps: ['Run every gold report on a branch with no pledges'],
    expected: ['Zero totals render', 'No division by zero and no NaN'],
  },
  {
    id: 'GL-367', area: 'Concurrency & Reports', priority: 'P2', automation: 'auto',
    title: 'The pledge list is paginated, not unbounded',
    rules: ['API-3'],
    steps: ['Request the pledge list with a limit'],
    expected: ['The limit is honoured', 'A large vault does not return in one page'],
  },
];

/** Convenience counts used by the report builder and the coverage assertion. */
export const CASE_COUNT = CASES.length;
export const AUTOMATED_CASES = CASES.filter((c) => c.automation === 'auto');
export const MANUAL_CASES = CASES.filter((c) => c.automation === 'manual');
