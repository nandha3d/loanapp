# ZoloFund — Calculation Logic (micro-lending)

Every number the micro-lending module puts in front of a borrower, an agent or an
auditor, written as the formula that produces it, with the code that owns it and
the executable case that pins it.

**Precedence.** `ENGINEERING_REFERENCE.md` remains the architecture authority; where
it states a money rule (`MONEY-*`, `NPA-*`) this document expands it, never
contradicts it. If a change makes a formula here false, change both in the same
commit (rule DOC-1).

**Executable.** Every `CALC-*` id below is a real case in
[tests/calc/cases.json](../tests/calc/cases.json). Run them with:

```bash
npx tsx tests/calc/run.ts            # all 184
npx tsx tests/calc/run.ts --group=penalty
npx tsx tests/calc/run.ts --id=CALC-ORG-013
```

Another agent can execute the same suite without reading this document —
see [tests/calc/AGENT_RUNBOOK.md](../tests/calc/AGENT_RUNBOOK.md).

---

## 1. Money representation and rounding

| Concern | Rule |
|---|---|
| Storage | `Decimal` in Prisma; `Number()` at the edge of every pure function. |
| Rupees vs paise | All loan-side money is whole rupees. Only **provisioning** carries paise. |
| Rounding direction | `Math.round` (half-up) everywhere except instalment splitting, which floors and dumps the remainder on the last row. |
| Negative money | Blocked by the caller, not by the formula. `calculateLoanPreview` rejects a negative *rate*, not a fee that exceeds the principal (`CALC-ORG-026`). |

---

## 2. Loan products — `lib/loanCalculator.ts:68`

Five interest models. `rate` means a different thing in each; that is the single
largest source of confusion in this codebase.

Term shape is separate from all five: see §2.6.

| Model | What `rate` means | Disbursed | Total payable |
|---|---|---|---|
| `upfront_fixed` | flat **₹** fee | `P − rate` | `P` |
| `upfront_percentage` | **%** of principal | `P − round(P × rate/100)` | `P` |
| `emi_flat` | **%** of principal, once over the whole tenure | `P` | `P + P × rate/100` |
| `emi_floating` | **% per annum**, reducing balance | `P` | `round(EMI) × n` |
| `interest_only` | **% per month** | `P` | `P + monthlyInterest × n` |

### 2.1 upfront_fixed — `CALC-ORG-001`, `CALC-ORG-002`

```
deduction     = rate                     (rupees, not a percentage)
disbursed     = P − deduction
totalPayable  = P
```

The fee is taken at the door. The borrower still repays the whole principal, so
the schedule sums to `P`, not to `P − fee`.

> ₹10,000 at a ₹1,000 fee over 10 daily instalments → hand over ₹9,000, collect
> ₹1,000 × 10.

### 2.2 upfront_percentage — `CALC-ORG-003`, `CALC-ORG-004`

```
deduction     = round(P × rate / 100)
disbursed     = P − deduction
totalPayable  = P
```

`round` here is what keeps the deduction in whole rupees; the payable is
untouched by it.

### 2.3 emi_flat — `CALC-ORG-005`, `CALC-ORG-006`, `CALC-ORG-007`

```
interest      = P × rate / 100           ← ONCE for the whole tenure, not p.a.
disbursed     = P
totalPayable  = P + interest
```

10% on ₹10,000 over 10 weeks is ₹1,000 — not 10% p.a. pro-rated to ten weeks.
`CALC-ORG-006` exists to pin that reading, because "12%" on a 12-month loan and
"12%" on a 3-month loan mean the same rupees here, and reviewers repeatedly read
it as annual.

### 2.4 emi_floating — `CALC-ORG-008` … `CALC-ORG-012`

Standard reducing-balance annuity. The period count comes from the frequency:

| Frequency | periods/year |
|---|---|
| `daily` | 365 |
| `weekly` | 52 |
| `biweekly` | 26 |
| `monthly` (and anything else) | 12 |

```
i             = (rate / 100) / periodsPerYear
EMI           = P × i × (1+i)^n / ((1+i)^n − 1)
totalPayable  = round(EMI) × n           ← rounded ONCE, then multiplied
```

`i = 0` short-circuits to `totalPayable = P` — without it the annuity divides by
zero (`CALC-ORG-012`).

> ₹1,00,000 at 12% p.a. over 12 months → EMI 8,884.88 → 8,885 × 12 = ₹1,06,620.

Because the EMI is rounded **before** multiplying, `totalPayable` is a clean
multiple and the last-row remainder is zero for this model.

### 2.5 interest_only — `CALC-ORG-013` … `CALC-ORG-016`

The Check/Gold-base product. The rate is **per month**.

```
monthlyInterest      = round(P × rate / 100)
deduction            = 0
disbursed            = P                 ← nothing is netted off
totalPayable         = P + monthlyInterest × n
aprPercent           = rate × 12
principalDueAtClosure= P                 ← a bullet, OUTSIDE the schedule
```

Two invariants that hold nowhere else:

- **`sum(schedule) ≠ totalPayable`.** The schedule carries interest only
  (`n × monthlyInterest`); the principal is settled at closure. `CALC-ORG-013`
  asserts the inequality on purpose.
- **A non-monthly frequency is rejected** (`MONEY-3`, `CALC-ORG-015/016`). A
  monthly rate billed daily would multiply the charge ~30×.

Branch with `isInterestOnly(type)` (`lib/loanCalculator.ts:48`), never the string
literal (`MONEY-4`, `CALC-ORG-023/024`).

### 2.6 Bullet term — `CALC-ORG-027` … `CALC-ORG-037`

A second axis, independent of the five models above. `termType` is `scheduled`
(n instalments at a cadence) or `bullet` (one payment on a named date):

```
maturityDate  = startDate + termDays          (calendar days)
schedule      = ONE row, dueAmount = totalPayable
tenure        = 1 (enforced)

effectiveAnnualPercent = (totalPayable − disbursed) / disbursed × 365/termDays × 100
```

The charge itself is unchanged — `upfront_fixed`, `upfront_percentage` and
`emi_flat` all work exactly as §2.1–2.3 describe. Only the schedule shape differs.

> ₹1,00,000 for 15 days at a flat 3%: disburse ₹1,00,000, collect ₹1,03,000 on
> day 15. Deduct the same 3% instead and the borrower gets ₹97,000 and repays
> ₹1,00,000 — identical rupees to the lender, **75.26% against 73.00%** to the
> borrower, because the fee is funded out of a smaller advance.

`emi_floating` (an annuity that degenerates at n=1) and `interest_only` (a
monthly rate over a term of days) are **rejected**, as is a tenure above 1 or a
day count that is not a positive whole number. Opt-in per tenant via
`bullet_term_enabled`, enforced in the origination route as well as the form.

Omitting `termType` produces exactly what it always produced — `CALC-ORG-036`
and `CALC-ORG-037` are the regression pins for that (STABLE-2).

### 2.7 Unknown model — `CALC-ORG-017`

Falls back to `totalPayable = disbursed = P`, `deduction = 0`. A typo in the type
never invents a charge.

---

## 3. Instalment distribution — `lib/loanCalculator.ts:58`

```
base       = floor(totalPayable / n)
amounts    = [base] × n
amounts[n−1] += round(totalPayable − base × n)
```

Sum is exactly `totalPayable`, always (`CALC-ORG-019` … `CALC-ORG-022`). The
remainder lands on the **last** instalment — never spread, never on the first.

> ₹1,000 over 3 → `[333, 333, 334]`.

Edge worth knowing: a tenure larger than the payable in rupees produces zero-rupee
dues (₹5 over 10 → nine ₹0 rows, one ₹5 row, `CALC-ORG-022`).

`interest_only` does **not** use this function — its rows are flat
(`CALC-ORG-014`).

---

## 4. Schedule dates — `lib/utils.ts:118`

Two distinct paths: with a `dueDay` and without one.

### 4.1 Without `dueDay` (or any daily loan) — `CALC-SCH-001/002/003/007/011/012`

| Frequency | Step from the start date |
|---|---|
| `daily` | `+i` days |
| `weekly` | `+7i` days |
| `biweekly` | `+14i` days |
| `monthly` | same day-of-month, **clamped to the month end** |

> 31 Jan → 28 Feb → 31 Mar → 30 Apr. The anniversary day never overflows into the
> next month (`CALC-SCH-011`).

### 4.2 With `dueDay` — `CALC-SCH-004/005/006/008/009/010/013`

- **Weekly / biweekly**: `dueDay` is 0–6 (Sun–Sat). The first due rolls **forward**
  to the next matching weekday; it never back-dates (`CALC-SCH-004`).
- **Monthly**: `dueDay` is 1–28 and is **clamped to 28** — choosing the 31st gives
  the 28th, so February is never skipped (`CALC-SCH-010`). If the start date is
  already past the chosen day, the first due moves to next month
  (`CALC-SCH-008`).

The monthly `dueDay` branch is built entirely in **UTC** on purpose: instalment
`dueDate`s are stored and read back as UTC midnight, and the local-time
constructor it used to call shifted every due date by a day east of UTC.

### 4.3 Maturity — `lib/utils.ts:105`, `CALC-SCH-015/016/017`

`calculateEndDate` is start + `tenure` × the frequency step. Note it is **not**
the last instalment date: for a daily loan it is start + n days, while the last
due is start + (n−1) days.

### 4.4 Timezone sensitivity

The §4.1 monthly branch reads **local** date parts from a Date that was built at
UTC midnight. Verified identical under IST and UTC. West of UTC the local day is
the previous date, which would shift the clamp. Run the suite under `TZ=UTC` when
comparing results across machines; the runner records the offset it saw in
`test-report/calc-results.json`.

---

## 5. Repayment allocation — `lib/repayments.ts`

### 5.1 Fill order — `orderInstalmentsForCollectionFill` (`:83`), `MONEY-10`

```
1. today's due
2. overdue backlog, oldest first
3. future dues, soonest first
   ties → lower instalmentNo first
```

Paying today's amount keeps today clean even when a backlog exists. This is a
business decision, not a sorting accident — do not "fix" it to strict
oldest-first (`CALC-ALO-008/009/010`).

### 5.2 Per-instalment status — `MONEY-11`

Derived, never hand-set:

```
received ≥ due                  → paid
received > 0                    → partial
dueDate < today                 → missed
otherwise                       → upcoming
status was 'waived'             → waived (preserved)
```

`outstanding = max(0, due − received)` (`CALC-ALO-017/018`), and
`overdueAmount = outstanding` only when the due date is strictly in the past —
**today's due is not yet overdue** (`CALC-ALO-006`).

`daysOverdue = floor((today − dueDate) / 1 day)`, floored at 0.

### 5.3 Loan status — `resolveLoanStatus` (`:154`)

```
scheduleSettled = totalInstalments > 0 AND paidCount + waivedCount = totalInstalments

closed   ⟸ scheduleSettled AND NOT (principalOutstanding > 0)
overdue  ⟸ overdueAmount > 0
active   ⟸ otherwise
```

`principalOutstanding` is supplied **only** for interest-only loans. Without that
guard a borrower who paid twelve months of interest would have their ₹10L
principal marked repaid (`CALC-ALO-013/014`).

### 5.4 Persistence — `reallocateLoanRepayments` (`:196`)

Money stays on the row it was recorded against. This function recomputes
**statuses, overdue figures and loan status** from what each row actually holds;
it does not re-spread payments. Waived rows are filtered out before allocation.

Schedules must not be modified once `hasFinancialActivity(loanId)` is true
(`MONEY-12`).

---

## 6. Penalties — `lib/penalties.ts`

> **Two different formulas are live.** They write to the same `Penalty` rows.
> See §14.1 — this is the most consequential divergence in the module.

### 6.1 Formula A — the accrual cron (`:19`), `MONEY-14`

Used by `/api/cron/accrue-penalties`.

```
chargeableDays = Σ over overdue instalments of max(0, daysOverdue − grace)
grossPenalty   = chargeableDays × penaltyPerDay
if maxCap > 0:  grossPenalty = min(grossPenalty, maxCap)
```

Per-tenant `AppSetting`s: `default_penalty_per_day`, `penalty_grace_period`,
`penalty_max_cap`. A cap of **0 means uncapped**, not zero (`CALC-PEN-004`).
Grace applies **per instalment**, not once per loan (`CALC-PEN-006`).
`missedDays` in the result is the chargeable **day** count, and the cap does not
reduce it — so a capped penalty stays visible as capped (`CALC-PEN-003`).

Cases: `CALC-PEN-001` … `CALC-PEN-011`, `CALC-PEN-015`.

### 6.2 Monotonicity — `shouldUpdatePenaltyGross` (`:44`), `MONEY-15`

Recorded gross only ever **increases**. A reduction is a waiver, recorded as
`waivedAmount` — never by rewriting gross (`CALC-PEN-012/013/014`). The accrual
runs inside a transaction so concurrent sweeps cannot duplicate rows.

### 6.3 Net penalty due

```
netPenaltyDue = max(0, Σ grossPenalty − Σ settledAmount − Σ waivedAmount)
```

---

## 7. Foreclosure — `lib/foreclosure.ts:99`

```
principalOutstanding = interest_only ? outstandingPrincipal
                                     : max(0, principal − totalCollected)
netPenaltyDue        = max(0, gross − settled − waived)
maxDiscount          = principalOutstanding + netPenaltyDue
safeDiscount         = min(max(0, discount), maxDiscount)
totalSettlement      = max(0, maxDiscount − safeDiscount)
```

- A discount beyond the balance is **clamped**; a settlement never goes negative
  (`CALC-FCL-003`), and a negative discount is treated as zero (`CALC-FCL-004`).
- Interest-only reads differently on purpose: collections so far were interest,
  so netting them off the principal would understate the settlement. The line
  items say so in words (`CALC-FCL-006/007`).
- Only `active` and `overdue` loans can be foreclosed. `closed` and `pending` get
  a reason and a zeroed calculation (`CALC-FCL-008/009`).
- `paidInstalments` in the output is **paid + partial** — a display decision, not
  a count of settled rows.

---

## 8. Interest-only servicing — `lib/interestOnly.ts`

```
monthlyInterest = round(max(P,0) × max(rate,0) / 100)      (:26)
aprPercent      = rate × 12                                 (:31)
interestCollected = Σ receivedAmount over all instalments
interestDueNow    = Σ outstanding over instalments in {missed, partial}
totalDueToClose   = outstandingPrincipal + interestDueNow
```

Only dues that have already come around count towards a closure — an upcoming
month's interest has not been earned and must not be charged on exit
(`CALC-IO-006`).

A **null** `outstandingPrincipal` means the full principal is still owed; legacy
rows must not read as repaid (`CALC-IO-008`). A part-payment of principal reduces
every future month's interest, because the interest is computed on the
*outstanding* principal, not the original (`CALC-IO-007`).

---

## 9. NPA classification — `lib/npa/npaClassifier.ts`

### 9.1 Days overdue — `calculateMaxOverdueDays` (`:256`), `NPA-1`

The clock starts at the **oldest unpaid instalment's due date**, not the most
recent. "Unpaid" means `receivedAmount < dueAmount`, so a partially paid row still
counts (`CALC-NPA-002/003/004`).

### 9.2 The ladder — `determineCategory` (`:288`)

| Days overdue | Category | Case |
|---|---|---|
| 0 | `standard` | `CALC-NPA-005` |
| 1–30 | `sma_0` | `CALC-NPA-006/007` |
| 31–60 | `sma_1` | `CALC-NPA-008/009` |
| 61–90 | `sma_2` | `CALC-NPA-010/011` |
| 91+ | NPA, sub-category by **time since first classification** | `CALC-NPA-012` |

Within NPA, measured from `npaClassifiedAt`:

| Days in NPA | Category | Case |
|---|---|---|
| ≤ 365 | `sub_standard` | `CALC-NPA-013` |
| ≤ 730 | `doubtful_d1` | `CALC-NPA-014` |
| ≤ 1095 | `doubtful_d2` | `CALC-NPA-015` |
| > 1095 | `doubtful_d3` | `CALC-NPA-016` |

`loss` and `written_off` are never reached by the ladder — they are explicit
business decisions.

`npaClassifiedAt` is stamped **once** (`NPA-2`). Restamping it on a later run
would reset a three-year-old doubtful asset to sub-standard —
`CALC-NPA-017` shows the same 95 days overdue landing in D3 purely because of the
classification date.

A loan at `sub_standard` or worse also moves `Loan.status` to `npa` (`NPA-3`),
which makes it **uncollectible through the normal path** (`CALC-COL-017`).

### 9.3 Provisioning — `lib/npa/provisioningCalculator.ts:30`, `NPA-4`

```
provisioningAmount = round(outstanding × rate / 100, 2 dp)
outstanding        = totalPayable − totalCollected
```

| Category | Secured | Unsecured |
|---|---|---|
| `standard`, `sma_0/1/2` | 0.40% | 0.40% |
| `sub_standard` | 15% | 15% |
| `doubtful_d1` | 25% | **100%** |
| `doubtful_d2` | 40% | **100%** |
| `doubtful_d3`, `loss`, `written_off` | 100% | 100% |

`isSecured` defaults to **false** — the conservative direction. Never default it
to true (`CALC-PRV-009`). Provisioning is the one figure carrying paise
(`CALC-PRV-010`).

---

## 10. Cash float — `lib/wallet.ts:13`, `MONEY-16..18`

```
next = available + delta
if hardBlock and next < 0:  throw InsufficientFloatError(available, −delta)
```

`hardBlock` is **opt-in per call site**. `disburseFromAgent` / `disburseFromBranch`
pass it; other movements do not, and an unguarded caller can drive a pool negative
(`CALC-FLT-005` pins that, and defect ML-122 is a live instance in the v1 wallet
release route).

**Only cash legs move float** (`MONEY-17`). Bank, UPI, cheque and DD appear in the
cash book and GL but must not touch physical cash-in-hand.

Every wallet mutation happens inside the caller's transaction (`MONEY-18`).

---

## 11. Collection policy — `lib/collectionPolicy.ts`

### 11.1 Is today a collection day? — `isCollectionDay` (`:29`)

Anchored on the instalment's own due date, in IST.

```
daily     → always
diff ≤ 0  → always (due today, or a future anchor)
weekly    → diff % 7  = 0
biweekly  → diff % 14 = 0
monthly   → same day-of-month, or the month-end clamp when the due day
            exceeds this month's length
```

A weekly borrower in arrears resurfaces on their weekday, once a week — not every
day (`CALC-COL-002/003`).

### 11.2 Collectibility

Collectible statuses are `active` and `overdue` only.

| Status | Reason returned |
|---|---|
| `pending_review` | "Loan is pending approval" |
| `closed`, `foreclosed`, `settled` | "Loan is closed" |
| anything else (incl. `npa`) | "Loan is not active for collection" |
| instalment already full | "Instalment is already fully collected" |

Cases `CALC-COL-011` … `CALC-COL-017`.

### 11.3 Idempotency — `buildCollectionIdempotencyKey` (`:94`), `MONEY-13`

```
tenantId : agentId : instalmentId : amount(2dp) : mode(lowercased, trimmed) : YYYY-MM-DD
```

A retried mobile submission must not double-post. A **different amount is a
different key**, so a correction is not silently suppressed
(`CALC-COL-018` … `CALC-COL-021`).

---

## 12. Credit score — `lib/creditScore.ts:4`

```
onTime          = Σ max(0, paid − 1.5×missed − 0.5×partial)
punctualityRatio= max(0, onTime / Σ tenure)
points          = punctualityRatio×55 + (closedLoans/totalLoans)×35
                  + min(10, totalBorrowed/50000 × 10)
score           = 300 + round(points × 5.5)
```

| Score | Grade |
|---|---|
| ≥ 780 | Excellent |
| ≥ 680 | Good |
| ≥ 560 | Fair |
| ≥ 440 | Poor |
| else | Very Poor |

No loans, or no repayment activity at all, returns `score 0 / grade "N/A"` — a new
borrower is never graded on an empty record (`CALC-CRS-001/002`).

A missed instalment costs 1.5 on-time payments and a partial costs 0.5, so a
borrower with four paid, two missed and one partial scores 5% punctuality
(`CALC-CRS-004`).

---

## 13. Origination guards — `lib/loanPolicy.ts`

`validateLoanNumericInputs` rejects, with these exact strings:

| Condition | Message |
|---|---|
| `principal ≤ 0` or not finite | "Principal must be greater than zero." |
| `rate < 0` or not finite | "Deduction or interest rate cannot be negative." |
| `tenure` not a positive integer | "Tenure must be a positive whole number." |
| `penaltyRate < 0` or not finite | "Penalty rate cannot be negative." |

`calculateLoanPreview` throws the same conditions with its own wording, plus
"Invalid start date." and the interest-only frequency rejection
(`CALC-VAL-001` … `CALC-VAL-011`).

---

## 14. Known divergences and traps

Each of these is real, currently in the tree, and pinned by a case or named here
so it is not rediscovered as a surprise.

### 14.1 Two penalty formulas write the same rows — **money-affecting**

| | Cron path | Page-load path |
|---|---|---|
| Function | `calculatePenaltyAccrual` | `ensurePendingPenaltiesForMissedLoans` (`lib/penalties.ts:48`) |
| Trigger | `/api/cron/accrue-penalties` | every dashboard load, the penalties page, `GET /api/penalties` |
| Gross | `Σ max(0, daysOverdue − grace) × default_penalty_per_day` | `count(missed instalments) × Loan.penaltyRate` |
| Grace | honoured | **ignored** |
| Cap | honoured | **ignored** |
| `missedDays` means | chargeable days | number of missed instalments |

Both write `Penalty.grossPenalty`, and the reconciliation takes
`max(recordedGross, liveGross)`. So the larger of the two wins, and because the
page-load path knows nothing about `penalty_grace_period` or `penalty_max_cap`,
**opening the penalties page can raise a borrower's penalty above the tenant's
configured cap** and can charge inside the grace window. `MONEY-14` documents only
the cron formula. One of the two has to move.

### 14.2 The pure allocator does not skip waived rows — `CALC-ALO-007`

`allocatePaymentsAcrossInstalments` keeps a waived instalment in the fill order, so
it absorbs payment that then never appears against a payable row. The persistence
path filters waived rows out first. The pure allocator currently has **no
production caller** (tests only), so this is a trap rather than a live defect —
wiring one up without adding the filter would mis-state collections.

### 14.3 `Loan.deduction` stores the amount, not the rate

The column name reads like a rate. It holds rupees. Any report dividing by it is
wrong.

### 14.4 The credit-score doc comment is stale — `CALC-CRS-005`

`lib/creditScore.ts:2` still says "from 0 to 100". It returns 300–850.

### 14.5 `hardBlock` is opt-in — `CALC-FLT-005`

The float guard is a parameter, not a property of the account. Every new call site
that moves money out must pass it. Defect ML-122 is what happens when one does not.

### 14.6 Schedule dates read local date parts in one branch

§4.4. Verified stable IST↔UTC; unverified west of UTC.

---

## 15. Running the suite

```bash
npm run test:calc          # run + rebuild the report page
npx tsx tests/calc/run.ts  # run only
```

Results land in `test-report/calc-results.json` (machine-readable, includes the
timezone the run saw) and `test-report/calculation-logic.html` (the page).

The suite is pure arithmetic — no database, no server, no network. It is the
fastest gate in the repo and should stay that way: a case that needs a running
app belongs in `tests/e2e/microlending/` instead.
