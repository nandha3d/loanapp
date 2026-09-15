# 03 — Gold Loan Completion (P1)

## Objective
Finish gold lending so it is end-to-end on **web and mobile**, with valuation, LTV, packet/storage, and
pledge→release tracking — surpassing Vasool's gold module (valuation/pledge/redemption) by auto-computing LTV from a
tenant-set rate and adding maturity/auction reminders.

## Vasool benchmark
Gold loan management: valuation, pledging, redemption.

## Current state (file:line)
- **Web: built.** `GoldLoanCollateral` Prisma model (packetNo, gross/netWeightGrams, purityKarat, marketRatePerGram,
  assessedValue, eligibleLtvPercent, storageLocation, valuerName, valuationDate, releaseStatus `pledged|released`,
  photoPath, documentPath). Web origination form sets these in
  `app/(dashboard)/[module]/loans/actions.ts:54-82`.
- **Mobile: partial.** `loan.dart:25` has `loanType` incl. `'gold'`; `new_loan_screen.dart:61-72` has
  `goldGrams/goldCarat/goldItems` fields but **no** valuation/LTV/packet/release UI and no wiring to
  `GoldLoanCollateral`.
- Module already enabled for business/enterprise plans (`lib/plans.ts`), slug `goldloan` valid.
- **Missing:** release-tracking UI (web + mobile) even though `releaseStatus` exists in the model.

## Gap
1. Mobile cannot originate a full gold loan (no valuation/LTV/packet capture, no collateral persistence).
2. No pledge→release workflow UI anywhere (model supports it; UI doesn't).
3. LTV is entered manually on web; should auto-calc from rate × weight × purity (rate from `AppSetting`).

## Design (DB/config-driven)
- **Mobile origination:** extend `new_loan_screen.dart` gold section to capture the full `GoldLoanCollateral` field
  set and POST to the same endpoint the web form uses. Reuse generic loan-create; add gold sub-payload.
- **LTV auto-calc (no hardcode):** `assessedValue = netWeightGrams × ratePerGram(purity)`,
  `eligibleAmount = assessedValue × eligibleLtvPercent/100`.
  - `ratePerGram` per purity comes from `AppSetting` keys: `gold_rate_per_gram_22k`, `..._18k`, etc. (admin-editable,
    default null → require entry). **Never inline a rate.**
  - `eligibleLtvPercent` default from `AppSetting` `gold_default_ltv_percent` (e.g. RBI-aligned), overridable per loan.
- **Release workflow:** new UI (web + mobile) to move `releaseStatus` `pledged → released` on full repayment/redemption,
  capturing release date + officer; writes audited like other actions.
- **Surpass:** optional gold-rate auto-fetch hook (pluggable provider via `.env` URL; falls back to manual
  `AppSetting`), and maturity/redemption reminders reusing the notification/cron pipeline
  (`app/api/cron/send-reminders`).

## Schema changes
- Likely none for core (model exists). **Additive** if added: `GoldLoanCollateral.releasedAt`, `releasedBy`,
  `redemptionAmount` (all nullable). Itemize before implementing.

## API contract
Reuse existing loan-create + a gold collateral sub-resource. Add a small `PATCH` to set release status (mirrors
existing loan-action server actions). Mobile uses the same `/api/v1/...` envelope as other writes.

## Web UI / Mobile UI
- Web: add LTV auto-calc to `loans/actions.ts` form; add a Release action on the gold loan detail page.
- Mobile: full gold capture in `new_loan_screen.dart`; release action on loan detail; works through offline queue (§02).

## i18n keys (6 langs)
`gold.field.packet`, `gold.field.grossWeight`, `gold.field.netWeight`, `gold.field.purity`, `gold.field.rate`,
`gold.field.assessedValue`, `gold.field.ltv`, `gold.field.eligible`, `gold.field.storage`, `gold.field.valuer`,
`gold.action.release`, `gold.status.pledged`, `gold.status.released` — `i18n/*` + `kStrings`.

## Scope / RBAC guards
`appScope('goldloan')` on all collateral queries; page guard `requireModule(tenantId,'goldloan')`. Release action
restricted to admin/authorized roles.

## Feature-flag & rollout
Gated by `goldloan` in `enabledModules` (already). Ship web LTV-autocalc + release first, then mobile origination.

## No-hardcode checklist
- [ ] Gold rates & default LTV read from `AppSetting`, never inline.
- [ ] Purity options sourced from a config list, not duplicated literals.
- [ ] All strings via i18n; settings exposed in module settings page.

## Test plan
- Unit: LTV/eligibility math across purities; rounding.
- Integration: mobile gold origination persists full `GoldLoanCollateral`; release flips status + audit row.
- Regression: web gold form still works; non-gold loans unaffected.

## ⚠️ Structure Impact
**Additive.** Mobile UI + reuse of existing model; optional nullable columns for release metadata.
**Breaking:** none. (If release-metadata columns are added, list them for sign-off — all nullable/defaulted.)
