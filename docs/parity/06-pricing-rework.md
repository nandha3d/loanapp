# 06 — Pricing Rework: De-hardcode + Compete (P0)

## Objective
Two outcomes: (1) eliminate the 3 pricing hardcodes so pricing is **fully DB-driven** per Rule 1; (2) restructure
plans to **beat Vasool's ₹699 flat / unlimited-staff** offer while keeping our free-tier + multi-product edge.

## Vasool benchmark
- **Standard ₹699/mo + 18% GST** — 1 loan product type, **unlimited staff**, 1 GB storage, GPS, reports/analytics export.
- **Custom** — 2–6 product types, contact sales.
- Extra storage ₹49/GB/mo. Referral discounts. **No free tier. No published annual discount.**

## Current state (file:line)
DB-driven catalog already exists and is admin-editable:
- `SubscriptionPlanCatalog` / `ModulePriceCatalog` / `AddonCatalog` (`prisma/schema.prisma:1096-1144`),
  seeded by `prisma/seed-pricing.ts`, served by `app/api/pricing/route.ts`, edited live in
  `app/admin/billing/pricing/PricingClient.tsx`.
- Runtime limits/flags on `TenantSubscription` (`schema:1058-1094`), enforced by
  `lib/subscription.ts:84-113` (`checkLimit`).

**3 hardcode debts (violate Rule 1):**
1. `app/(marketing)/pricing/page.tsx:16-41` — static `PLANS` array (won't reflect catalog edits).
2. `app/api/webhooks/razorpay/route.ts:139-148` — sets limits from `PLAN_FEATURES` (code), not `SubscriptionPlanCatalog`.
3. `lib/plans.ts:16-54` — `PLAN_FEATURES` / `PLAN_PRICING` used as a source rather than fallback-only.

## Gap
- Marketing prices can drift from real catalog → de-hardcode required.
- Webhook writes stale code-based limits on renewal → de-hardcode required.
- Plan ladder is agent-gated at the low end → loses to ₹699 unlimited-staff.

## Design — Part A: De-hardcode (the priority)
1. **Marketing page → DB.** `app/(marketing)/pricing/page.tsx` fetches `/api/pricing` (server component / ISR) and
   renders catalog rows. Remove the literal `PLANS` array. Keep a typed fallback **only** if the API fails.
2. **Razorpay webhook → catalog.** At `:139-148`, read the plan's limits/modules from `SubscriptionPlanCatalog`
   (by `plan` key) instead of `PLAN_FEATURES`. Write those to `TenantSubscription`. `PLAN_FEATURES` becomes
   fallback-only.
3. **Demote `lib/plans.ts`.** Mark `PLAN_FEATURES`/`PLAN_PRICING` as last-resort fallback; ensure every runtime read
   path hits the catalog/`TenantSubscription` first.
4. **Invoice fallback** (`razorpay/route.ts:166-195`) likewise prefers the Razorpay/catalog amount over `PLAN_PRICING`.

## Design — Part B: Competitive ladder (numbers live in catalog/seed, never in page code)
Recommended tiers (user approves/adjusts; all set via `seed-pricing.ts` + admin editor):

| Plan | ₹/mo (+18% GST) | Agents | Branches | Active loans | Modules | Beats Vasool |
|---|---|---|---|---|---|---|
| Free | 0 | 1 | 1 | 25 | 1 vertical | Vasool has none |
| **Collector (NEW)** | **699** | **Unlimited** | 1 | 500 | any **1** vertical | Matches price; **+free tier, +voice, +offline, +bureau-add-on** |
| Basic | 999 | 15 | 2 | 500 | 2 verticals | More agents/loans, same price |
| Business | 2,999 | 60 | 6 | 1,500 | all verticals + premium acct + KYC | Multi-product Vasool can't match |
| Enterprise | 7,999 | Unlimited | Unlimited | Unlimited | all + bureau + NPA + compliance | No Vasool equivalent at any price |

Plus:
- **Annual billing −2 months** (≈16% off) — Vasool has no published annual discount.
- **Per-branch seat model option** for Collector/Basic to neutralize agent-count anxiety.
- **Storage add-on** parity (`AddonCatalog` row, e.g. ₹49/GB/mo) — configurable, not inline.
- Keep existing add-ons (WhatsApp/SMS ₹299, KYC ₹399, GPS ₹199, Premium acct ₹599, Bureau ₹199) in `AddonCatalog`.

> The **Collector** plan is the strategic counter: same headline price as Vasool, unlimited agents, but with our free
> tier above it and voice/offline/compliance Vasool lacks. Single-product framing keeps multi-vertical value in Basic+.

## Schema changes
Likely none — catalog tables already hold price/limits. **Additive** only if a new gate is needed (e.g.
`TenantSubscription.maxStorageGb`, defaulted). Itemize before adding.

## API contract
`/api/pricing` + `/api/v1/pricing` already expose catalog. Marketing + checkout consume them. Add the `Collector`
plan + revised limits as **catalog rows**, not code.

## Web UI
- Marketing pricing page renders from `/api/pricing`.
- Admin editor (`PricingClient.tsx`) already supports CRUD — use it to enter the new ladder; seed defaults in
  `seed-pricing.ts`.

## i18n keys (6 langs)
Plan display names/descriptions are catalog fields (not i18n) but marketing chrome strings
(`pricing.annualToggle`, `pricing.perBranch`, `pricing.collector.tagline`) go in `i18n/*`.

## Enforcement
`checkLimit()` already enforces loans/agents/branches/modules from `TenantSubscription`. Confirm the new limits flow
from catalog → subscription on purchase/renewal (Part A item 2 guarantees this).

## No-hardcode checklist
- [ ] No price/limit literal remains in `pricing/page.tsx`.
- [ ] Webhook reads catalog, not `PLAN_FEATURES`.
- [ ] New ladder entered as catalog rows + `seed-pricing.ts`, not inline.
- [ ] `lib/plans.ts` constants only ever used as fallback.

## Test plan
- Edit a price in admin editor → marketing page reflects it (no deploy). Proves de-hardcode.
- Simulate `subscription.charged` webhook → `TenantSubscription` limits match catalog, not code.
- `checkLimit` blocks at the new agent/loan caps per plan.
- Free→Collector→Business upgrade paths set correct modules/limits.

## ⚠️ Structure Impact
**Additive / corrective.** De-hardcode changes the *source* of values, not behaviour shape — but item A2/A3 alter how
existing renewal/limit writes resolve, so they are **flagged for sign-off** (low risk, but they touch the billing
path). New `Collector` plan = pure data. Optional `maxStorageGb` column = Additive. **No table drops/renames.**
