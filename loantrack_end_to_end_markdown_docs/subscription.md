# Tenant Self-Registration, Pricing Catalog, And Tenant-Scoped Subscription Plan

## Summary
Build tenant self-registration for web and Flutter mobile with email/password and Google ID-token authentication. New registrations activate immediately on a trial for the selected subscription plan, create the tenant owner as that tenant’s `superadmin`, and generate a module-aware slug like `green-finance-ml-af`.

Also replace hardcoded/default-tenant behavior so non-developer users always resolve to their own `tenantId`, not the seeded `loantrack/default` tenant.

## Key Changes
- Add a DB-backed pricing catalog for subscription plans, modules, and add-ons, seeded from current `lib/plans.ts` defaults.
- Add subscription pricing snapshot fields to `TenantSubscription` so each tenant stores its selected plan, modules, add-ons, limits, and quoted monthly total at signup/update time.
- Add public registration APIs:
  - Web email registration creates tenant, subscription, default branch, and superadmin user.
  - Web Google registration verifies Google ID token, then creates/links the superadmin user.
  - Mobile `/api/v1` equivalents return the existing mobile JWT shape.
- Add Google auth support:
  - Web: Google Identity ID-token flow plus a credentials-style NextAuth provider for session creation after token verification.
  - Mobile: add `google_sign_in`, exchange ID token with backend, then persist the returned JWT/tenant slug.
- Add `/register` web flow and mobile registration screens:
  - Business details, owner details, module selection, plan selection, add-on selection, pricing quote, submit.
  - Slug rule: slugified business name plus ordered module codes: `ml`, `af`, `cf`; append numeric suffix on collision.
- Add developer pricing settings under developer mode:
  - Manage subscription plan price/features.
  - Manage per-module prices.
  - Manage add-on prices.
  - Existing tenant subscription management uses catalog defaults but still allows per-tenant overrides.
- Fix tenant scoping:
  - Keep developer as the only tenant-bypass role.
  - `superadmin`, `admin`, and `agent` resolve from session `tenantId`.
  - Developer pages that manage a tenant use explicit tenant IDs from route/form data, never the fallback default tenant.
  - Root-domain fallback to the seeded tenant remains only for unauthenticated/public/developer-safe cases.

## Public Interfaces
- New/updated env vars: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_ID`; existing Razorpay envs remain supported.
- New API responses include `tenantSlug`, `subscription`, and selected `enabledModules`.
- Mobile adds endpoints in `Endpoints`: register by email, register/login by Google, fetch public pricing catalog.
- Prisma adds pricing catalog models and optional Google identity fields on `User`.

## Test Plan
- Unit tests for module-based slug generation, pricing quote math, reserved slug/collision behavior, and Google/email registration validation.
- Auth/security tests proving a superadmin resolves to their own tenant instead of `default/loantrack`.
- API tests for email registration, Google token rejection, duplicate slug handling, tenant subscription creation, and mobile JWT return.
- Developer pricing tests for plan/module/add-on CRUD and per-tenant override preservation.
- Run `npm run typecheck`, focused TS tests, `npm run test:security`, and Prisma validation.
- Confirm `node -v` is `v22.22.0` or newer; current workspace reports `v22.22.2`.
- After implementation, rerun browser visual checks for `/login`, `/register`, registration plan selection, developer pricing, and tenant billing.

## Assumptions
- Self-registered tenants start active on a trial immediately after choosing a plan.
- Google mobile auth uses native Flutter Google Sign-In.
- Tenant slug format is business name plus selected module bundle, for example `green-finance-ml` or `green-finance-ml-af-cf`.
- Razorpay checkout remains plan-based initially; catalog pricing drives displayed quotes, tenant snapshots, and invoices, with Razorpay plan IDs mapped per subscription plan.
