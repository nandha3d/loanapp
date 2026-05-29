# 11 · Calculations & Architecture (calc-parity) — P0

**Principle:** every business calculation is computed **once, server-side**, and returned by an `/api/v1/*` endpoint. No client recomputes anything. This guarantees web, mobile, and future clients always show the same numbers.

## Known divergences / risks

### A. Credit score — RESOLVED ✅
- Canonical source: `lib/creditScore.ts#calculateCreditScore` (300–850 + grade).
- Web reads it directly. Mobile previously read a separate `/customers/[id]/loans` value and rendered a hand-rolled **0–100** ring → showed **74 / "Medium Risk"** while web showed **706 / "Good"**.
- Fix: `/api/v1/customers/[id]` now returns the canonical object; mobile renders it verbatim. No score math in Dart.

### B. Restructured instalment rate — NEEDS API MOVE ⚠️ (P0)
- Currently computed in Dart: `mobile/lib/features/loans/loan_detail_screen.dart#computeRestructuredRate`.
- Same formula exists in web (`LoanDetailClient.tsx`). **Two implementations = drift risk.**
- **Action:** add the restructured rate to the loan detail API so both clients read it.
  - Endpoint: extend `GET /api/v1/loans/[id]` to include, per still-collectable instalment (due today/later, unpaid), `restructuredAmount`, plus a loan-level `restructuredRate` and `remainingCollectableCount`.
  - Source the math from a shared `lib/restructure.ts` (new) that **both** the web component and the API import (web import is allowed — it's not a UI change, just sharing a pure helper; if the owner prefers zero web touch, the API can replicate the formula and the web keeps its copy until a later refactor).
  - Remove `computeRestructuredRate` from Dart; read `restructuredAmount` from the API model.
- Acceptance: toggling "Show Restructured Rate" shows server-provided figures; web and mobile identical to the rupee.

### C. Dashboard "today vs overdue" collected — VERIFY 🔢
- Web dashboard computes `todayCollected` (today's instalments) and overdue daily snapshot server-side (page is server-rendered).
- Mobile dashboard reads `/api/v1/dashboard`, which now returns `todayCollected`, `todayGap`, `overdueOutstanding`, `overdueCollectedToday`, `overdueTotalTillToday` (added this cycle). ✅ Same formulas as web.
- **Action:** keep any future dashboard math in `/api/v1/dashboard` only.

### D. Loan progress / outstanding — VERIFY 🔢
- `paidCount`, `totalCollected`, `status` are persisted by `reallocateLoanRepayments` (server). Mobile reads them. ✅
- Loan detail header day-counts (`dynamicRemainingCount`) are derived client-side on both platforms identically (`ceil(outstanding/perInstalment)`); acceptable but ideally surface from the API loan summary.

## Audit checklist for every new mobile screen

- [ ] Does it display any number not directly returned by the API? → move to API.
- [ ] Does it filter/aggregate lists client-side in a way the web does server-side? → prefer server filters/params.
- [ ] Are money values formatted from raw API decimals (not re-derived)?
- [ ] Are statuses derived from a single shared rule? (see collection status derivation).

## Suggested shared modules

- `lib/restructure.ts` — restructured rate (B).
- Keep `lib/creditScore.ts`, `lib/repayments.ts`, `lib/penalties.ts` as the **only** sources of those calcs; expose via v1 endpoints as needed.
