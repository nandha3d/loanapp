# Affiliate Marketing & Tracking — Plan

## Locked decisions
1. **Who:** both — every **superadmin** auto-gets an affiliate ID + tracking; **outsiders** can register a bare affiliate ID (no app login). Referral via ID / link only.
2. **Reward base:** monthly path = **30% commission on referred customers' subscription revenue**.
3. **Trigger:** reward unlocks at **10 referred tenants who become PAID subscribers**.
4. **Reward by affiliate's own term:** yearly → **1 year free**; monthly → **30% × 5 months** of referred revenue.

## Reward math (codified in `lib/affiliate.ts`)
- `computeAffiliateReward()` + `compareAffiliatePaths()`.
- Example (M ₹1000, Y ₹10000, 10 referrals @₹1000/mo): yearly = **₹10,000**, monthly = **₹15,000** → **monthly costs us more** (30% payout vs ~10%). Verified.

## Data model (standalone tables — scalar FK ids, no Prisma relations)
```prisma
model Affiliate {
  id, code @unique          // referral ID (in the link)
  name, email?, phone?
  userId?  @unique          // links to a superadmin User; null for outsiders
  tenantId?                 // the superadmin's tenant; null for outsiders
  status @default("active")
  createdAt
}
model Referral {
  id, affiliateId
  referredTenantId?         // tenant created via this affiliate
  referredEmail?
  status @default("signup") // signup | subscribed | churned
  planTerm?                 // monthly | yearly
  monthlyPrice?  Decimal
  subscribedAt?, createdAt
}
model AffiliateReward {
  id, affiliateId
  type                      // free_year | commission_5mo
  amount Decimal
  status @default("pending")// pending | granted | paid
  periodStart?, periodEnd?, createdAt, grantedAt?
}
```

## Flows
1. **Get ID:** superadmin opens Affiliate page → `Affiliate` row auto-created (code = short id), shows link `…/r/<code>`. Outsider hits a public `/affiliate` page → registers name/email → gets a code + link.
2. **Attribution:** registration page (`/register?ref=<code>`) stores the ref; on tenant signup → `Referral(signup)`; on first paid subscription → `Referral.status=subscribed` + planTerm + monthlyPrice.
3. **Unlock:** when an affiliate hits 10 `subscribed` referrals → create `AffiliateReward` via `computeAffiliateReward` (yearly→free_year applied to the affiliate's tenant sub; monthly→commission_5mo payout schedule).
4. **Tracking dashboard (superadmin):** referrals list, paid count, progress to 10, projected/earned reward, both-path comparison.

## Endpoints / pages (phases)
- **Phase 1 (done):** reward-calc lib + schema + migration.
- **Phase 2:** `GET/POST /api/affiliate/me` (get-or-create my affiliate + stats), public `POST /api/affiliate/register`, attribution hook in tenant registration.
- **Phase 3:** superadmin Affiliate tracking page (web) + public `/affiliate` + `/r/[code]` landing.
- **Phase 4:** reward grant engine (cron/lazy on subscribe) + payout status; mobile surface for superadmin (optional).

## Risk / guardrails
- Count only **paid** referrals (anti-fraud).
- Cap monthly commission or steer to yearly (monthly is the costlier payout — see math).
- One reward per 10-referral cohort; idempotent grant.
