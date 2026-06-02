# K — Developer Panel (mobile)

**Priority:** P2 · **Persona:** Developer. (System Settings is split out as **J10**, P0.)

## Stories
- **K1** Pricing catalog management (plans, modules, add-ons + prices).
- **K2** Affiliate config + rewards ledger.
- **K3** Tenant impersonation (P3).

## Verified facts
- Web/API already exist (web session-auth): `app/api/developer/pricing/{plans,modules,addons}/route.ts`, `app/api/developer/affiliate/{config,rewards}/route.ts`, `app/api/developer/impersonate/route.ts`.
- These are **session-cookie** endpoints. For mobile, add **Bearer** mirrors under `app/api/v1/developer/**` that reuse the same lib functions, gated to `ctx.role === 'developer'`.
- Public pricing read already exists: `app/api/v1/pricing/route.ts` (catalog) — used by registration.

## Implementation
1. **Endpoints (new, Bearer, developer-gated):**
   - `GET/POST/PATCH /v1/developer/pricing/{plans,modules,addons}` → reuse the logic in the matching `app/api/developer/pricing/*` route.
   - `GET/PUT /v1/developer/affiliate/config`, `GET /v1/developer/affiliate/rewards` → reuse `lib/affiliate.ts` (`getAffiliateConfig`, reward calc).
   - *(P3)* `POST /v1/developer/impersonate` → issues a scoped mobile token for the target tenant (security review required).
2. **Screens** under `mobile/lib/features/developer/`:
   - `pricing_catalog_screen.dart` (tabs: plans/modules/addons; edit price/limits).
   - `affiliate_admin_screen.dart` (config form + rewards list).
3. **Entry:** developer-only tiles in the settings/drawer (same gating as J10).

## Acceptance criteria
- [ ] All endpoints reject non-developers (403).
- [ ] Catalog edits reflect in registration pricing.
- [ ] Affiliate config matches `lib/affiliate.ts` constants; rewards math from API.
- [ ] Impersonation (if built) passes a security review before merge.

## Files touched
- NEW `app/api/v1/developer/**`.
- NEW `mobile/lib/features/developer/**` + service + models + routes.
- `app_strings.dart`.
