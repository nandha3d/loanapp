# White-Label Reseller Program — Design Document

> Status: **DESIGN / NOT IMPLEMENTED.** Drafted 2026-07-17 against `merged-all-branches`. This document defines the model, the data + code changes, the billing/settlement mechanics, and the decisions we need from the business before building. Nothing here is coded yet.

## 1. Context & goal

We want a **reseller (white-label partner) program**:

1. Each reseller runs the product on **their own separate domain** with their own branding — end customers never see "LoanTrack".
2. We (the platform) set a **base cost** per plan/module/add-on — the wholesale price the reseller pays us.
3. The reseller sets **their own retail price** on top of our base cost and sells to their own customers, keeping the margin.
4. A reseller owns a **portfolio of downstream tenants** (their customers). They onboard, price, and support those tenants; we support the reseller.

In short: **we → reseller (wholesale) → end tenant (retail)**, a two-tier billing chain, with per-reseller domains and branding.

### What already exists (reused, not rebuilt)

The codebase is already multi-tenant and most of the white-label primitives exist:

- **Per-tenant custom domain** — `Tenant.customDomain` (unique) + `Tenant.slug` (subdomain). Host→tenant resolution already handles both: `getTenantIdFromHost`, `tenantIdForCustomDomain`, `isStandaloneDomainHost` in `lib/tenant.ts`.
- **Per-tenant branding** — `getBranding(tenantId)` in `lib/tenant.ts` reads `app_name`, `app_tagline`, `logo_url`, `primary_color`, … from `AppSetting`. The UI already themes from these.
- **Composable pricing** — `SubscriptionPlanCatalog` (base plans), `ModulePriceCatalog` (per-module), add-ons, composed in `lib/pricing.ts` (`calculateVerticalSubscriptionPricing`) and snapshotted onto `TenantSubscription` (`basePlanPrice`, `modulesPrice`, `addonsPrice`, `totalMonthlyPrice`, `selectedAddons`, `enabledModules`).
- **Billing** — `BillingInvoice` per tenant + Razorpay (`razorpaySubId`, `lib/subscription.ts`).
- **Role hierarchy** — `developer` (us, platform owner) > `superadmin` (tenant owner) > `admin` > `agent` > `borrower`.
- **Partner economics precedent** — the affiliate system (`Affiliate`/`Referral`/`AffiliateReward`) proves the pattern of tracking downstream conversions and computing partner value; but it is *referral commission*, not *reseller markup*, so it is a precedent, not the mechanism.

### What is greenfield (this program adds it)

- A **`reseller` role** and a **`Reseller` entity** (a partner org that owns many tenants).
- **Tenant → reseller ownership** (`Tenant.resellerId`).
- A **base-cost vs sell-price split** on every priced line (plan/module/add-on) — we store our wholesale cost and the reseller's retail price separately.
- A **reseller pricing layer** — how a reseller sets markup over our base cost.
- **Reseller-scoped domains, branding, and admin console** — a reseller manages only their own portfolio and never sees our internal margin structure beyond the base cost we expose to them.
- **Two-sided settlement** — we invoice the reseller at base cost; the reseller invoices their end tenants at retail; reconciliation of the margin.

---

## 2. Roles & the ownership tree

```
developer (us)                     ← platform owner: sees everything, sets base cost
  └── reseller (partner)           ← NEW: owns a domain + a portfolio of tenants, sets retail markup
        └── superadmin (end tenant owner)   ← the reseller's customer
              └── admin / agent / borrower
```

- **New role `reseller`.** Sits between `developer` and `superadmin` in every RBAC check. A reseller user authenticates like any staff user but is scoped to their `Reseller` org, not a single tenant.
- **Direct (non-reseller) tenants still exist.** Tenants we sell to directly have `resellerId = null` and behave exactly as today — this program is additive, not a migration of the existing base.
- A reseller **cannot** see other resellers, other resellers' tenants, or our full internal pricing (cost-of-goods, other resellers' markups). They see: our base cost, their own markup, their own tenants, their own settlement statement.

---

## 3. Data model changes (all additive)

### 3.1 New `Reseller` entity

```prisma
model Reseller {
  id             String   @id @default(cuid())
  name           String                                   // partner org name
  slug           String   @unique                         // reseller subdomain, e.g. acme.<ourRoot>
  primaryDomain  String?  @unique @map("primary_domain")  // reseller's own white-label domain
  status         String   @default("active")              // active | suspended | closed
  billingEmail   String?  @map("billing_email")
  // Default markup applied to our base cost when the reseller onboards a tenant
  // and hasn't set a per-line price. Percentage OR flat is chosen per line in
  // ResellerPrice; this is the fallback.
  defaultMarkupPct Decimal @default(0) @map("default_markup_pct") @db.Decimal(6, 2)
  // Wallet/credit the reseller has prepaid us against (optional prepaid model).
  creditBalance  Decimal  @default(0) @map("credit_balance") @db.Decimal(14, 2)
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")
  deletedAt      DateTime? @map("deleted_at")

  tenants        Tenant[]
  prices         ResellerPrice[]
  users          User[]                                   // reseller-role users

  @@map("resellers")
}
```

### 3.2 Ownership + branding cascade on `Tenant`

```prisma
model Tenant {
  // ...existing...
  resellerId String? @map("reseller_id")                  // null = direct/platform tenant
  reseller   Reseller? @relation(fields: [resellerId], references: [id])
  @@index([resellerId])
}
```

Branding resolution becomes a **cascade**: end-tenant branding → falls back to reseller branding → falls back to platform default. (`getBranding` gains a reseller lookup; reseller branding lives in a `ResellerSetting` table mirroring `AppSetting`, or a JSON column on `Reseller` — see §7 decision.)

### 3.3 `User` gains reseller scope

```prisma
model User {
  // ...existing...
  resellerId String? @map("reseller_id")                  // set for role='reseller' users
}
```

### 3.4 Reseller retail pricing — `ResellerPrice`

Our base cost lives in the existing catalogs (`SubscriptionPlanCatalog.monthlyPrice`, `ModulePriceCatalog.monthlyPrice`, add-on catalog). A reseller overlays a retail price per line:

```prisma
model ResellerPrice {
  id          String   @id @default(cuid())
  resellerId  String   @map("reseller_id")
  // What this price is for:
  lineType    String   @map("line_type")     // 'plan' | 'module' | 'addon'
  lineKey     String   @map("line_key")       // plan name / module key / addon key
  // The reseller's retail price for this line (what THEIR tenant pays them).
  // Must be >= our base cost for that line at onboarding time (enforced server-side).
  retailPrice Int      @map("retail_price")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  reseller    Reseller @relation(fields: [resellerId], references: [id])
  @@unique([resellerId, lineType, lineKey])
  @@map("reseller_prices")
}
```

### 3.5 Base-cost snapshot on `TenantSubscription`

Today `TenantSubscription` snapshots the retail price the tenant pays (`basePlanPrice`/`modulesPrice`/`addonsPrice`/`totalMonthlyPrice`). We add the **wholesale (base cost) snapshot** so margin is computed and frozen at the moment of sale:

```prisma
model TenantSubscription {
  // ...existing (these stay = what the END TENANT pays)...
  // NEW — what the RESELLER owes US for this tenant (our base cost snapshot):
  wholesaleBasePrice   Int @default(0) @map("wholesale_base_price")
  wholesaleModulesPrice Int @default(0) @map("wholesale_modules_price")
  wholesaleAddonsPrice Int @default(0) @map("wholesale_addons_price")
  wholesaleTotalPrice  Int @default(0) @map("wholesale_total_price")
  // margin = totalMonthlyPrice - wholesaleTotalPrice (reseller's cut), derived not stored.
}
```

For direct tenants (`resellerId = null`) the wholesale fields simply equal the retail fields (margin 0), so all reporting is uniform.

### 3.6 Settlement — `ResellerInvoice`

We bill the reseller, not their tenants (recommended model — see §5). A monthly rollup:

```prisma
model ResellerInvoice {
  id            String   @id @default(cuid())
  resellerId    String   @map("reseller_id")
  billingPeriod String   @map("billing_period")   // e.g. 2026-07
  // Sum of wholesaleTotalPrice across all the reseller's ACTIVE tenants for the period.
  wholesaleAmount Decimal @db.Decimal(14, 2) @map("wholesale_amount")
  tenantCount   Int      @map("tenant_count")
  status        String   @default("pending")       // pending | paid | overdue | waived
  dueDate       DateTime @map("due_date")
  paidAt        DateTime? @map("paid_at")
  razorpayId    String?  @map("razorpay_id")
  lineItemsJson String   @map("line_items_json") @db.LongText  // per-tenant breakdown
  createdAt     DateTime @default(now()) @map("created_at")
  @@index([resellerId, billingPeriod])
  @@map("reseller_invoices")
}
```

---

## 4. Domains & branding

### 4.1 Domain topology

Two supported shapes per reseller (they pick one, or use both):

- **Reseller subdomain** — `acme.<ourRoot>` via `Reseller.slug`. Zero DNS work for them; instant.
- **Reseller's own domain** — `app.acmefinance.com` via `Reseller.primaryDomain`. They add a CNAME/A record to our load balancer; we issue TLS (Let's Encrypt wildcard already in `deploy/nginx.conf`, or per-domain certbot).

End tenants under a reseller are then **subdomains/paths of the reseller's domain** (e.g. `client1.app.acmefinance.com`) OR the tenant keeps its own `customDomain` that resolves to a tenant owned by that reseller. Host resolution extends `lib/tenant.ts`:

- `getTenantIdFromHost` already resolves `customDomain` and `slug`.
- **New:** if the host matches a `Reseller.primaryDomain` (root, no tenant subdomain), render the **reseller's landing/login**, not a tenant app.
- The reseller root domain hosts the reseller-branded signup + login; a tenant is resolved from the subdomain or the authenticated session.

### 4.2 Branding cascade

`getBranding` becomes 3-level: **tenant `AppSetting` → reseller branding → platform default**. A reseller with no per-tenant override gets a fleet of identically-branded tenants for free. Fields cascade individually (a tenant can override just its logo while inheriting the reseller's colors).

### 4.3 White-label mobile app (decision needed — §7)

The web is trivially white-label (per-host branding). The **mobile app** is a single compiled binary pointing at one API base URL and one app icon/name. True per-reseller mobile white-labeling means either (a) a build-per-reseller pipeline (new app icon/name/package id, separate Play Store listing), or (b) a single "LoanTrack-neutral" app that themes per-login. This is the biggest scoping question — see §7.

---

## 5. Billing & settlement — the money flow

**Recommended model: we bill the reseller wholesale; the reseller bills their tenants retail.** This keeps us out of the reseller↔end-customer relationship (cleaner tax/liability) and matches "they sell it for their own pricing over our base cost."

```
End tenant  --pays retail-->  Reseller        (reseller's own billing/PG, their invoice, their GST)
Reseller    --pays wholesale-->  Us (platform) (ResellerInvoice, our PG, our GST to the reseller)
Reseller keeps:  retail − wholesale  = margin
```

Mechanics:

1. When a reseller onboards a tenant, the tenant's `TenantSubscription` snapshots **both** the retail price (what the tenant pays the reseller) and our wholesale base cost (`wholesaleTotalPrice`).
2. Monthly, a cron (mirror of `app/api/cron/dunning` / `subscription-reminders`, `CRON_SECRET`-gated) rolls up each reseller's active tenants into a `ResellerInvoice` at **wholesale** total, with a per-tenant line-item breakdown.
3. We collect the `ResellerInvoice` from the reseller (Razorpay, same rails as `BillingInvoice`), or draw down `Reseller.creditBalance` if they prepaid.
4. The reseller collects retail from their own tenants using **their own** payment gateway (the per-tenant PSP config already exists — `settings/payment-gateway`). We never touch end-customer money in this model.
5. Non-payment: if a reseller's `ResellerInvoice` goes overdue past grace, we suspend the reseller (cascade-suspends their tenants) — same state machine as tenant dunning today.

**Alternative model (platform-collect-and-remit)** — we collect retail from end tenants and remit margin to the reseller. Simpler for the reseller, but puts us in the money-transmission path (heavier compliance, we owe the reseller a payout). Flagged as a decision in §7; the recommended model above avoids it.

### 5.1 What the reseller sees vs. what stays hidden

- Reseller **sees:** our base cost per line, their retail price per line, their per-tenant margin, their `ResellerInvoice` history, their portfolio.
- Reseller **never sees:** our internal cost-of-goods below the base cost we quote them, other resellers, other resellers' markups, or platform-wide financials.
- End tenant **sees:** only their retail price and the reseller's branding — no "base cost", no "reseller", no "LoanTrack".

---

## 6. Console & permission changes

- **New reseller console** (reuse the `app/admin/**` shell, scoped to `resellerId`): portfolio list (their tenants), onboard-a-tenant wizard, per-line retail pricing editor (shows our base cost as the floor), branding editor, settlement statements, support inbox.
- **RBAC:** every tenant-scoped query a reseller runs is filtered by `tenant.resellerId === session.resellerId` (a new `scopedResellerWhere`, analogous to `scopedChitGroupWhere`). Reseller users get a hard `resellerId` pin exactly like the `appType='chitfunds'` hard-pin pattern in `lib/chits/access.ts`.
- **Developer console** gains a Resellers section: create/suspend resellers, set the base-cost catalogs (already `/api/developer/pricing/*`), view cross-reseller settlement, set each reseller's `defaultMarkupPct` ceiling/floor.
- **Impersonation** (`/api/developer/impersonate`) extends to "developer → reseller" and "reseller → their tenant" for support.
- **Price-floor enforcement:** `ResellerPrice.retailPrice >= base cost` enforced server-side at write time and re-checked at tenant-onboard time (guards a reseller from accidentally selling below our cost).

---

## 7. Decisions needed from you (before we build)

These change the shape of the build materially:

1. **Billing direction** — *Recommended:* we bill the reseller wholesale; they bill their tenants retail (we never touch end-customer money). Alternative: we collect retail from end tenants and remit margin. **Which?**
2. **Mobile white-labeling depth** — (a) neutral single app that themes per-login (cheap, ships now), (b) build-per-reseller with their own icon/name/Play Store listing (expensive, per-partner pipeline + Apple/Google accounts), or (c) web-only for resellers initially. **Which tier?**
3. **Markup model** — reseller sets an absolute retail price per line (max control), OR a single percentage markup over base applied everywhere (simplest), OR both (per-line price with a % default). **Which?**
4. **Prepaid vs postpaid** — resellers prepay a credit wallet we draw down, or we invoice them monthly in arrears. **Which?** (affects `creditBalance` vs `ResellerInvoice` emphasis.)
5. **Tenant domains under a reseller** — are end tenants subdomains of the reseller's domain (`client1.app.acme.com`), their own custom domains, or reseller-domain-only (path-based)? **Which are we supporting at launch?**
6. **Tax/GST invoicing** — in the recommended model we raise a GST invoice to the reseller; the reseller raises their own to their customers. Confirm this matches your accountant's expectation.
7. **Reseller onboarding gate** — self-serve signup on a "become a partner" page, or manual approval by us (developer creates the reseller)? **Which?**
8. **Base-cost visibility** — do resellers see the live base-cost catalog (auto-updates if we change prices, with notice), or a contract-frozen base cost per reseller? **Which?**

---

## 8. Phased rollout (once decisions are locked)

- **Phase 0 — schema (one additive migration):** `Reseller`, `ResellerPrice`, `ResellerInvoice`, `Tenant.resellerId`, `User.resellerId`, wholesale snapshot columns on `TenantSubscription`. All nullable/defaulted; zero change for existing tenants.
- **Phase 1 — reseller identity & isolation:** `reseller` role, `scopedResellerWhere`, host resolution for reseller domains, reseller login + a read-only portfolio view. No pricing yet.
- **Phase 2 — pricing & onboarding:** base-cost catalog exposed to resellers, `ResellerPrice` editor with floor enforcement, onboard-a-tenant wizard that snapshots retail + wholesale onto `TenantSubscription`.
- **Phase 3 — branding cascade & domains:** reseller branding, 3-level `getBranding`, custom-domain provisioning + TLS.
- **Phase 4 — settlement:** monthly `ResellerInvoice` rollup cron, Razorpay collection from resellers, dunning/suspension cascade, reseller settlement statements.
- **Phase 5 — mobile** (per decision #2): neutral-theming or per-reseller build pipeline.

## 9. Verification (per phase, at build time)

- Isolation: a reseller user querying tenants sees only `resellerId === own`; cross-reseller access → 403 (mirror the audit-01 negative tests).
- Pricing floor: attempt to set `retailPrice < base cost` → rejected; onboard a tenant → `TenantSubscription` carries both retail and wholesale snapshots with correct margin.
- Domain: reseller root domain serves reseller login; tenant subdomain serves tenant app; branding cascades tenant→reseller→platform.
- Settlement: seed a reseller with N tenants, run the rollup cron → one `ResellerInvoice` at Σ wholesale with correct per-tenant line items; overdue → reseller + tenants suspended.
- Regression: existing direct tenants (`resellerId = null`) bill and behave exactly as before.

## 10. Critical files (when we implement)

- `prisma/schema.prisma` + one additive migration.
- `lib/tenant.ts` — host resolution for reseller domains; 3-level `getBranding`.
- `lib/pricing.ts` / `lib/subscription.ts` — wholesale-vs-retail split, floor enforcement, wholesale snapshot on subscribe.
- `lib/access.ts` — `reseller` role + `scopedResellerWhere`.
- `app/admin/**` — reseller console (scoped shell) + developer Resellers section.
- `app/api/developer/pricing/*` — expose base-cost catalog to resellers (read-only).
- `app/api/cron/reseller-settlement/route.ts` (new, `CRON_SECRET`-gated) — monthly rollup.
- `app/api/webhooks/razorpay/*` — handle `ResellerInvoice` payments alongside `BillingInvoice`.
