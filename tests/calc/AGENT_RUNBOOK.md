# Calculation-logic suite — runbook for an executing agent

Written for an AI agent other than the one that built this (Antigravity, Gemini
CLI, Codex, a CI bot). Everything needed to run, extend and report on the suite is
here; you do not need to read the application source first.

**What this suite is.** 173 declarative cases over the micro-lending money maths:
loan pricing, instalment schedules, repayment allocation, penalties, foreclosure,
interest-only servicing, NPA classification, provisioning, cash float, collection
policy, credit scoring. Pure arithmetic — no database, no HTTP server, no network.

**What this suite is not.** It does not test routes, permissions, branch scoping or
anything requiring a running app. Those live in `tests/e2e/microlending/`.

---

## 1. Run it

```bash
npm ci                                  # once
npx tsx tests/calc/run.ts               # all cases
npx tsx tests/calc/run.ts --group=penalty
npx tsx tests/calc/run.ts --id=CALC-ORG-013
npx tsx tests/calc/run.ts --quiet       # summary line only
npx tsx tests/calc/run.ts --file=path/to/other-cases.json
```

Or `npm run test:calc`, which also rebuilds the HTML report.

No `.env` is required. The harness sets a placeholder `DATABASE_URL` because the
money modules import the Prisma singleton at module scope; nothing connects.

**Exit codes**

| Code | Meaning |
|---|---|
| 0 | every selected case passed |
| 1 | at least one case failed |
| 2 | the runner itself could not run (bad filter, unreadable cases file, import error) |

**Reproducibility.** Run under `TZ=UTC` when comparing results across machines.
One schedule branch reads local date parts; results are verified identical under
IST and UTC. The runner records the timezone it saw in the results file.

---

## 2. Read the output

`test-report/calc-results.json`:

```jsonc
{
  "runAt": "2026-08-29T…",
  "environment": { "node": "v23.11.1", "timeZone": "Asia/Calcutta", "utcOffsetMinutes": 330 },
  "total": 173, "passed": 173, "failed": 0,
  "results": [
    {
      "id": "CALC-ORG-013", "group": "origination",
      "title": "interest_only bills one month's interest …",
      "rules": ["MONEY-3", "MONEY-4", "MONEY-5"],
      "op": "loan.preview",
      "status": "passed",
      "failures": [],          // one string per failed assertion
      "facts": { … },          // everything the op returned — read this first when debugging
      "error": undefined,      // the throw message, when the op threw
      "durationMs": 1
    }
  ]
}
```

`facts` is the whole return value of the wrapped function, so a failing case
usually needs no extra instrumentation — the answer is already in the file.

---

## 3. When a case fails

Work in this order. **Do not skip step 1.**

1. **Read the formula.** [docs/CALCULATION_LOGIC.md](../../docs/CALCULATION_LOGIC.md)
   states what the number should be and why, with the source file and line. The
   case's `rules` field names the binding rule in `ENGINEERING_REFERENCE.md`.
2. **Decide which side is wrong.** A failure is one of:
   - **an app defect** — the code no longer produces what the documented rule
     requires. Report it; do not silently "fix" the case.
   - **a stale case** — the rule itself changed deliberately. Then
     `ENGINEERING_REFERENCE.md`, `docs/CALCULATION_LOGIC.md` and the case all move
     together, in one commit (rule DOC-1).
3. **Never edit `lib/` to make a case pass** unless you have established, from the
   documented rule, that the code is the wrong side.
4. **Never paste the observed value into `expect`.** That converts a failing test
   into a snapshot of the bug. Derive the expected number from the formula by
   hand, and put the derivation in the case's `why` field.

Report a defect as: case id → the rule it violates → the file and line → the input
that reproduces it → observed vs required.

---

## 4. Add a case

Append to `tests/calc/cases.json`. Nothing else needs changing if you use an
existing `op`.

```jsonc
{
  "id": "CALC-PEN-016",              // GROUP-nnn, unique
  "group": "penalty",                // used by --group and by the report page
  "title": "one line, states the rule being pinned",
  "rules": ["MONEY-14"],             // optional, ids from ENGINEERING_REFERENCE.md
  "why": "the derivation, or why this edge matters",   // optional but expected for anything non-obvious
  "op": "penalty.accrual",           // see the table in §5
  "input": { … },                    // passed straight to the op
  "expect": { "grossPenalty": 600 }  // dotted paths → matchers
}
```

Errors are asserted instead of facts:

```jsonc
{ "op": "loan.preview", "input": { … }, "expectError": "must use a monthly frequency" }
```

`expectError` is a substring match on the thrown message. A case with
`expectError` fails if the call returns normally; a case without it fails if the
call throws.

### Matchers

| Form | Meaning |
|---|---|
| `"expect": { "total": 106620 }` | deep equality (works for arrays and objects too) |
| `{ "approx": 8884.88, "tol": 0.5 }` | numeric tolerance (default `tol` 0.01) |
| `{ "gte": 300 }` / `lte` / `gt` / `lt` | comparisons |
| `{ "contains": "Interest collected" }` | substring, or array membership |
| `{ "oneOf": ["closed", "settled"] }` | any of |
| `{ "length": 12 }` | array length |
| `{ "not": <any matcher> }` | negation |

Paths are dotted and support indices: `"dueAmounts.0"`, `"lineItemLabels[2]"`.

---

## 5. Ops available

Every op wraps one real exported function. The harness derives nothing that the
function did not return — no formula is reimplemented there, and none should be.

| Op | Wraps | Key facts returned |
|---|---|---|
| `loan.preview` | `calculateLoanPreview` | `totalPayable`, `disbursedAmount`, `deduction`, `perInstalment`, `dueAmounts`, `dueDates`, `scheduleSum`, `scheduleSumEqualsPayable`, `monthlyInterest`, `aprPercent`, `principalDueAtClosure` |
| `loan.distribute` | `distributeInstalmentAmounts` | `amounts`, `sum`, `count` |
| `loan.isInterestOnly` | `isInterestOnly` | `result` |
| `loan.validate` | `validateLoanNumericInputs` | `valid`, `error` |
| `loan.canCreateForRole` | `canCreateLoanForRole` | `result` |
| `schedule.dates` | `calculateInstalmentDates` | `dates`, `first`, `last`, `count` |
| `schedule.endDate` | `calculateEndDate` | `endDate` |
| `repay.allocate` | `allocatePaymentsAcrossInstalments` + `summarizeAllocations` | `statuses`, `received`, `outstanding`, `overdue`, `daysOverdue`, `loanStatus`, totals |
| `repay.fillOrder` | `orderInstalmentsForCollectionFill` | `order`, `dueDates` |
| `repay.loanStatus` | `resolveLoanStatus` | `status` |
| `repay.instalmentOutstanding` | `getInstalmentOutstanding` | `outstanding` |
| `penalty.accrual` | `calculatePenaltyAccrual` | `missedDays`, `grossPenalty` |
| `penalty.shouldUpdate` | `shouldUpdatePenaltyGross` | `result` |
| `foreclosure.build` | `buildForeclosureCalculation` | `principalOutstanding`, `netPenaltyDue`, `totalSettlementAmount`, `discount`, `canForeclose`, `reason`, `lineItemLabels` |
| `interestOnly.monthlyInterest` | `monthlyInterestFor` + `toAprPercent` | `interest`, `apr` |
| `interestOnly.summary` | `summarizeInterestOnlyLoan` | `outstandingPrincipal`, `monthlyInterest`, `interestCollected`, `interestDueNow`, `totalDueToClose` |
| `npa.overdueDays` | `calculateMaxOverdueDays` | `days` |
| `npa.category` | `determineCategory` | `category` |
| `npa.provisioning` | `calculateProvisioning` | `rate`, `amount`, `basis` |
| `wallet.float` | `calculateFloatBalance` | `balance` (throws `insufficient_float`) |
| `collection.isCollectionDay` | `isCollectionDay` | `result` |
| `collection.blockReason` | `getCollectionSubmissionBlockReason` | `reason` |
| `collection.loanBlockReason` | `getLoanCollectionBlockReason` | `reason` |
| `collection.idempotencyKey` | `buildCollectionIdempotencyKey` | `key` |
| `credit.score` | `calculateCreditScore` | `score`, `grade`, `punctuality`, totals |

Dates go in as `"YYYY-MM-DD"` strings and come back the same way. Money is whole
rupees everywhere except `npa.provisioning`, which carries paise.

### Adding a new op

Only when you need a function no op wraps. In `tests/calc/harness.ts`, import the
real function and return its output as flat facts. Do not compute money in the
harness — if a fact needs a derived figure, derive it from the function's own
output. A harness that calculates is a harness that tests itself.

---

## 6. Checking the runner still bites

Before trusting a green run on a machine you have not used before, confirm the
assertion engine actually fails:

```bash
cat > /tmp/selfcheck.json <<'JSON'
[{"id":"SELF-1","group":"selfcheck","title":"wrong number must fail","op":"loan.preview",
  "input":{"principal":10000,"interestType":"upfront_fixed","interestRate":1000,
           "tenure":10,"frequency":"daily","startDate":"2026-06-01"},
  "expect":{"disbursedAmount":9999}}]
JSON
npx tsx tests/calc/run.ts --file=/tmp/selfcheck.json    # must exit 1
```

---

## 7. Reporting back

Summarise as:

```
<passed>/<total> passed, <failed> failed   (node <v>, TZ <zone>)

FAILED
  CALC-XXX-nnn  <title>
    rule:     MONEY-nn
    expected: <the documented figure, and how it is derived>
    observed: <value from facts>
    verdict:  app defect | stale case | environment
```

State a verdict for every failure. "Unclear" is an acceptable verdict; a guess
dressed as a conclusion is not.
