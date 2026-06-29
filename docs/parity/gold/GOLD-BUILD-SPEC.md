# Gold Loan — Full-Featured Build Spec (DRAFT — awaiting competitor screens)

> Goal: a **full-featured gold-loan system, nothing lesser than the competitor**, in **our theme/style**,
> on **web + mobile**, **no hardcoding** (everything from the API layer), **without disturbing current structure**.
>
> Status: screen-independent sections are drafted. The **Screen Matrix (§4)** is a placeholder to be filled from
> the competitor document the user will paste/export (SharePoint link was 403). Plan is APPROVE-FIRST: no code is
> written until this spec is signed off.

---

## 1. Strict rules (non-negotiable)

1. **No hardcoding.** Every value (gold rates, LTV %, purity options, packet prefixes, storage locations, statuses,
   labels) comes from the **API layer** / DB (`AppSetting`, catalog, config endpoints) — never inline in a component.
   Gold rate auto-fills from `AppSetting` (`gold_rate_per_gram_*`); LTV default from `gold_default_ltv_percent`.
2. **No structure mess.** Additive only. New screens/fields/endpoints/columns with defaults. Anything that renames,
   removes, or changes existing behaviour is listed in **§8 Structure Impact** and needs explicit sign-off.
3. **API-layer source of truth.** Mobile and web both read/write gold data through the same versioned API
   (`/api/v1/...`). No business logic duplicated in the client; valuation math is the one shared module
   (`lib/gold/valuation.ts`, already built + tested).
4. **Our theme.** Use `APP_CONFIGS.goldloan` palette (gold/amber) + existing component library — visually ours, not
   a clone of the competitor's chrome.
5. **i18n complete.** Every new string in all 6 languages (web `i18n/*`, mobile `kStrings`). No English-only leaks.
6. **No full accounting on mobile** (explicit user constraint). Gold capture, valuation, release, register, and
   reports summary only.

---

## 2. Current state (verified in code)

| Layer | Reality |
|---|---|
| `GoldLoanCollateral` model | ✅ Rich: packet, gross/net weight, purity, market rate, assessed value, LTV%, storage, valuer, valuation date, **releaseStatus/releasedAt**, photo, doc (`prisma/schema.prisma`) |
| Customer geo | ✅ `lat`/`lng`/`geocodedAt` + `customer.goldCollaterals` relation exist |
| Web loan form gold UI | ⚠️ **Shallow** — only grams/carat/items, saved as a JSON blob (`LoanForm.tsx:516`), NOT mapped to the model |
| Web action handler | ✅ Reads full structured fields (`loans/actions.ts`) + LTV auto-calc — but **inert**, form doesn't send them |
| Mobile gold UI | ⚠️ Shallow — grams/carat/items JSON blob (`new_loan_screen.dart:587`) |
| Release/redemption UI | ❌ None anywhere (model supports it) |
| Storage/packet register | ❌ None |
| Gold reports | ❌ None gold-specific |
| Valuation math | ✅ `lib/gold/valuation.ts` (tested) — needs the form to feed it net weight + rate |

**Bottom line:** backend model is ready; the system is missing the *real UI + persistence wiring + release/register/reports*.

---

## 3. Data-model wiring (stop the JSON blob)

- Web `LoanForm` + mobile `new_loan_screen` capture the **structured** gold fields and POST them so the backend
  persists a **`GoldLoanCollateral`** row (not a JSON string in `collateralDetails`).
- Backend `/api/v1/loans` (create/update) accepts a `goldCollateral` object and upserts the row (handler shape
  already exists in `loans/actions.ts`).
- Assessed value auto-computes via `computeGoldValuation` when not entered; market rate prefilled from `AppSetting`.
- **Structure impact:** additive (uses existing model + existing handler). The only change to existing behaviour is
  the form payload shape → listed in §8 for sign-off.

## 3a. API contract (everything from the API layer)

New/confirmed endpoints (all `/api/v1`, tenant + `appScope('goldloan')` guarded):
- `POST /loans` / `PATCH /loans/:id` — accept `goldCollateral { packetNo, grossWeightGrams, netWeightGrams,
  purityKarat, marketRatePerGram, assessedValue?, eligibleLtvPercent?, storageLocation, valuerName, valuationDate,
  photoPath?, documentPath? }`.
- `GET /gold/config` — purity options, default LTV, current rates (from `AppSetting`) → **no hardcoded option lists**.
- `GET /gold/register` — pledged-items register (filters: status, storage, customer).
- `POST /loans/:id/gold/release` — pledged → released (date, officer, redemption amount).
- `GET /gold/reports/summary` — pledged value, LTV exposure, releases due, overdue gold.

## 4. Screen matrix — **TO FILL FROM COMPETITOR DOC** (placeholder)

For each competitor screen, map → our screen (web + mobile) + fields + status. Fill when user pastes screens.

| # | Competitor screen | Our web screen | Our mobile screen | Fields | HAVE / NEED |
|---|---|---|---|---|---|
| 1 | _pledge / new gold loan_ | `/goldloan/loans/new` (extend) | `new_loan_screen` (extend) | packet, weights, purity, rate, assessed, LTV, storage, valuer, date, photo, doc | NEED (structured) |
| 2 | _valuation / appraisal_ | inline in pledge | inline | auto-calc + manual override | partial (math done) |
| 3 | _packet / storage register_ | `/goldloan/register` (new) | `gold_register_screen` (new) | list + filters | NEED |
| 4 | _release / redemption_ | loan detail action | loan detail action | release date, officer, amount | NEED |
| 5 | _gold dashboard / reports_ | `/goldloan/reports` | summary cards | pledged value, exposure | NEED |
| … | _(remaining from doc)_ | | | | |

> Replace the italic rows with the actual competitor screens once provided, then mark HAVE/NEED per row.

## 5. Seed (GPS test data) — 15 customers + 15 gold loans

- Script `prisma/seed_gold_demo.ts` (additive; guarded to a demo tenant): 15 customers with **real lat/lng**
  (spread across a city so the mobile live map + geofence are testable), each with a gold loan + a structured
  `GoldLoanCollateral` (varied purity/weight/packet/storage), instalments generated via the existing loan calculator.
- Coordinates + names are demo literals **inside the seed only** (seeds are inherently literal; not app hardcoding).
- Run is gated (needs the user's DB): `npx tsx prisma/seed_gold_demo.ts`.

## 6. Mobile scope

- Structured gold capture in `new_loan_screen` (replace the 3-field blob), release action on loan detail, gold
  register screen, reports summary. **No accounting** (per constraint).
- Reuse Riverpod + `T.x` i18n + the offline queue where applicable.

## 7. i18n completion

- Web: ✅ complete (1777 keys × 6 langs verified).
- Mobile: ⚠️ **incomplete** — many `kStrings` entries are English-only (ta/ml ≈ 109 vs en ≈ 597). All **new gold
  strings** ship in 6 languages; **separately**, backfill the existing English-only mobile keys (tracked as its own
  task so the gold build isn't blocked on it).

## 8. ⚠️ Structure Impact (sign-off gate)

**Additive (safe):** new screens/routes (`/goldloan/register`, `/goldloan/reports`), new endpoints, new i18n keys,
new seed script, new mobile screens. The `GoldLoanCollateral` model already exists — no schema change for core gold.

**Behaviour-changing (needs explicit OK):**
- Gold loan form payload changes from JSON-blob → structured `goldCollateral` object (web + mobile). Existing
  blob-based gold loans remain readable; new ones use the structured row.
- Release action mutates `releaseStatus` (new write path).

**No** renames/drops of existing columns or routes.

## 9. No-hardcode checklist (per screen)

- [ ] Purity options, default LTV, gold rates from `/gold/config` (`AppSetting`), not inline.
- [ ] Statuses/labels via i18n in 6 languages.
- [ ] Storage locations from config/DB, not a literal list.
- [ ] Valuation only via `lib/gold/valuation.ts`.
- [ ] Mobile + web read identical data from `/api/v1` — no client-side business logic.

---

---

## 10. REFINED PLAN — approved decisions (supersedes §3 where conflicting)

Decisions from the user (2026-06-29):

### 10.1 Repayment engine — REUSE, don't replace
- **No new engine, no structural change.** Use the existing loan + interest engine (`lib/loanCalculator.ts`,
  interest types `upfront_fixed | upfront_percentage | emi_flat | emi_floating`, plus existing collection /
  foreclosure / renewal). The competitor's "monthly interest-only pledge" is represented **within** this engine as a
  configured interest scheme, not a parallel system.
- Gold-specific capabilities (pay-interest cycle, part-payment, redemption, take-over/renewal, bank repledge) are
  added as **features layered on the existing loan**, reusing existing payment/collection/accounting records where
  they already exist — not a new ledger.
- **Settings drive behaviour:** admin can set the default interest scheme/rate/processing fee per metal and
  **hide / show / set-default** any gold field or feature. Everything configurable, nothing hardcoded.

### 10.2 Gold + Silver
- Category selector **GOLD / SILVER** on pledge entry. Per-metal **rate/gram** and **interest %** come from
  settings/master (`AppSetting`: `gold_rate_per_gram_*`, `silver_rate_per_gram`, interest per metal). Same engine,
  metal is a config dimension — additive.

### 10.3 Structure impact — strictly additive (no restructure)
- **New child/master tables only** (gated migrations, unapplied until reviewed):
  - `GoldOrnamentItem` (child of `GoldLoanCollateral`): type, spec, qty, gross/wastage/net wt, rate/gram, value,
    bank, refNo.
  - Master: `OrnamentType`, `OrnamentSpecification`, `BankName` — the **no-hardcode source** for every dropdown.
- **Reuse existing** for servicing: collection/payment records for pay-interest + part-payment; foreclosure for
  redemption; renewal for take-over; audit log for deleted/modified/restored; expenses for expense entry.
- **No** changes to the loan/instalment engine, no column renames/drops. New settings = new `AppSetting` keys.

### 10.4 Build slices (tracer-bullet, each: build → typecheck/test → commit; migrations stay gated)
1. **Master data + settings** — `OrnamentType`/`OrnamentSpecification`/`BankName` tables + admin CRUD; gold/silver
   rate + interest + scheme + processing-fee + field show/hide settings. *(unblocks no-hardcode dropdowns)*
2. **Multi-ornament line items** — `GoldOrnamentItem` model + structured capture (web `LoanForm`, mobile
   `new_loan_screen`) feeding `GoldLoanCollateral` + items; value auto-calc via `lib/gold/valuation.ts`.
3. **Pledge servicing** — pay-interest, part-payment, redemption/close, take-over/renewal, bank repledge — as
   features on the existing loan, settings-gated.
4. **Gold reports** — recent/closed pledges, pending interests, paid interests, bank report, ornaments report,
   daily summary, notices, audit tabs.
5. **Gold dashboard** — ornament weights (active/closed), bank-wise, store rate, profit, cash balance, pending
   interest.
6. **Receipts** (EN + TA, from templates/settings) — loan, closing, part-payment, interest-bill.
7. **Mobile** — slices 2–6 on mobile (NO accounting), reuse Riverpod + `T.x` + offline queue.
8. **Seed** — 15 customers (lat/lng) + 15 gold/silver pledges with ornament items, for GPS testing.
9. **i18n** — all new strings EN + 6 langs; backfill mobile English-only keys touched.

### 10.5 No-hardcode (enforced every slice)
Ornament types/specs/banks/proof-types/rates/interest/scheme/processing-fee/receipt-T&C → **DB master + AppSetting,
served via `/api/v1`**. Web + mobile read identical data. Valuation only via `lib/gold/valuation.ts`.

### Next step
Plan refined per decisions above. **Awaiting final go** to start **Slice 1 (master data + settings)**. No code
until approved.
