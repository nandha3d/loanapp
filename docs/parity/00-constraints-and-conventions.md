# 00 — Constraints & Conventions (read first)

This file defines the **rules every other section obeys** and the **existing mechanisms** to reuse so we never
hardcode and never break structure silently.

---

## Rule 1 — NEVER HARDCODE

A value is "hardcoded" if changing it requires a code edit + redeploy. Forbidden for anything that varies by tenant,
plan, market, or time. Use the right store:

| Kind of value | Correct store | How to read | Ref |
|---|---|---|---|
| Module slugs | `ALL_MODULES` enum | `isModuleKey()` | `types/modules.ts:1-45` |
| Plan tiers / limits (catalog) | `SubscriptionPlanCatalog` (DB) | `/api/pricing` | `prisma/schema.prisma:1096-1116` |
| Module / addon prices | `ModulePriceCatalog`, `AddonCatalog` (DB) | `/api/pricing` | `schema:1118-1144` |
| Per-tenant runtime limits & flags | `TenantSubscription` cols | `getSubscription()` | `schema:1058-1094` |
| Tenant settings (penalty, prefixes, rates, cutoffs) | `AppSetting` (DB) | `getSetting/getBranding` | `lib/tenant.ts:267-302` |
| UI copy / labels (6 langs) | `i18n/*.ts` (web), `kStrings` (mobile) | `getDictionary()` / `T.of(ref).x()` | `lib/i18n.ts:33-35` |
| Module branding (colors/icon) | `APP_CONFIGS` | `getAppConfig()` | `lib/appConfig.ts:4-72` |
| Secrets / integration URLs | `.env` | `process.env.*` | `.env.example` |

**Known hardcode debts to fix (tracked in [`06-pricing-rework.md`](./06-pricing-rework.md)):**
- `app/(marketing)/pricing/page.tsx:16-41` — static `PLANS` array (should fetch `/api/pricing`).
- `app/api/webhooks/razorpay/route.ts:139-148` — reads `PLAN_FEATURES` (should read `SubscriptionPlanCatalog`).
- `lib/plans.ts:16-54` — `PLAN_FEATURES` / `PLAN_PRICING` used as runtime source instead of fallback-only.

> `lib/plans.ts` constants are allowed **only** as a last-resort fallback when the DB catalog is unreachable. They
> must never be the primary source at runtime.

---

## Rule 2 — NO STRUCTURE CHANGE WITHOUT SIGN-OFF

Every section ends with `⚠️ Structure Impact` split into:

- **Additive** — new columns with defaults, new tables, new routes, new optional fields, new i18n keys, new catalog
  rows. Backward compatible. May proceed once the section is approved.
- **Breaking** — renamed/removed columns, changed enums consumed by existing code, altered API response shapes,
  changed default behaviour of existing flows. **Requires explicit user approval, itemized, before implementation.**

A new lending vertical (sections 04, 05) is **Additive** at the DB/route level but touches several shared files
(`types/modules.ts`, `lib/plans.ts`, `lib/appConfig.ts`, `Sidebar.tsx`). Those edits are enumerated per-file in the
section and gated behind sign-off because they widen a shared enum.

---

## The "add a module" checklist (reused by 04 & 05)

When a section introduces a new vertical, it MUST wire all of these — and only these — following the autofinance precedent:

1. `types/modules.ts:1-6` — add slug to `ALL_MODULES`.
2. `types/modules.ts:10-15` — add `MODULE_SLUGS` label entry.
3. `types/modules.ts:24-29` — add `MODULE_ROUTES[slug]` (the route list this module exposes).
4. `lib/appConfig.ts:19-68` — add `APP_CONFIGS[slug]` (colors, icon, logo split, description).
5. `lib/plans.ts:16-54` — add slug to the `modules[]` of each plan that includes it.
6. `prisma/schema.prisma` — add the collateral/detail model **with `appType` column defaulted**, and add the slug to
   any `appType`-scoped model only if it stores rows for this vertical.
7. `prisma/seed-pricing.ts` — add a `ModulePriceCatalog` row (price may be ₹0 if bundled).
8. Routes under `app/(dashboard)/[module]/...` — reuse generic loan/customer/collection flows; add only vertical-specific pages.
9. `components/layout/Sidebar.tsx:60-86` — add nav items filtered by `appTypes:[slug]`.
10. Page entry guard — `await requireModule(tenantId, slug)` (`lib/moduleGate.ts:20`).
11. Every Prisma query — spread `appScope(slug)` into the `where` (`lib/scope.ts:58`).
12. i18n — add keys to `i18n/en.ts` and mirror in `ta/hi/te/kn/ml`.
13. Mobile — add slug to mobile module config + `kStrings`; reuse generic collection flow.

If any step is skipped, the module leaks data or 404s — the checklist is the contract.

## The "add a tenant-tunable value" checklist (reused everywhere)

1. Pick `AppSetting.key` (namespaced, e.g. `gold_rate_per_gram_22k`).
2. Read via `getSetting(tenantId, key, fallback)`; write via `setSetting`. Never inline the number.
3. Surface in `app/(dashboard)/[module]/settings` so admins edit it without a deploy.
4. Document the key + default in the section's No-hardcode checklist.

## The "add a feature flag" checklist

1. Prefer an existing `TenantSubscription` boolean (e.g. `gpsTrackingEnabled`). Add a new boolean column (Additive,
   default `false`) only if no existing flag fits.
2. Gate UI in `Sidebar.tsx` and gate server actions with a guard mirroring `requireModule`.
3. Expose toggle in `app/admin/billing/*` so it's data-driven per tenant.

---

## Definition of done (applies to every section)

- [ ] No new literal price/limit/rate/flag/copy in a component or route file.
- [ ] All new strings exist in all 6 language dictionaries.
- [ ] Every new query is `appScope`-d and module-gated.
- [ ] `⚠️ Structure Impact` reviewed; nothing in **Breaking** shipped without sign-off.
- [ ] Test plan green.
