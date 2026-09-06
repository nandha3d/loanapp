# Loanapp Frontend/Backend Separation Implementation Plan

## Summary

Implement **API boundary separation first**: keep the existing Next.js app as the backend host, make the web frontend consume `/api/v1/*` the same way Flutter already does, and remove direct Prisma/database access from UI pages and server actions.

The current repo has Next `16.2.6`, existing `/api/v1` coverage for loans, customers, collection, wallet, analytics, accounting, auth, upload, reports, etc., and 42 server-action files plus many dashboard pages still importing `@/lib/db`. Success means frontend routes/components no longer call Prisma directly; backend access is isolated to API routes and backend libraries.

## Key Changes

- Add a frontend API client layer under `lib/api-client/`:
  - `core.ts`: typed `apiFetch`, error envelope handling, absolute server-side URL resolution, `cache: 'no-store'` defaults for authenticated data.
  - `context.ts`: reads NextAuth session, tenant slug, active branch cookie, and mints a short-lived v1 JWT with `issueMobileToken`.
  - Domain clients for loans, customers, collection, wallet, settings, notifications, approvals, reports, vehicles, chits, accounting, admin, portal, and borrower flows.

- Keep NextAuth for web login, but make it a thin web session wrapper:
  - Do not persist v1 tokens in localStorage.
  - Server components/actions get a fresh v1 access token from session context.
  - Client components that must call `/api/v1` fetch a short-lived token from a protected route such as `app/api/auth/v1-token/route.ts`.

- Backfill missing `/api/v1` endpoints before converting each module:
  - Accounting premium gaps: budget, vendors/bills, tax, period lock, export, settings, approvals.
  - Admin/portal gaps: branch requests, module requests, billing/subscriptions, team/user management.
  - Borrower gaps: repayment submission, borrower dashboard/pay flows.
  - Keep file uploads through `app/api/v1/upload/route.ts`.

- Convert web modules in this order:
  1. Runtime/docs gate, inventory, API client, auth context.
  2. Low-risk modules: notifications, wallet, payment gateway settings.
  3. Core lending: customers, loans, loan detail actions, collection runs/entries, penalties.
  4. Operational modules: vehicles, chits, approvals, analytics, reports, dashboard, agent dashboard.
  5. Admin/portal/borrower flows.
  6. Accounting premium flows last, because they have the most missing API surface.
  7. Remove obsolete server-action DB imports and enforce the boundary with a static check.

## Implementation Rules

- Before code edits, read the shipped Next docs for this installed version:
  - `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md`
  - `07-mutating-data.md`
  - `15-route-handlers.md`
  - `03-api-reference/04-functions/fetch.md`
  - `03-api-reference/01-directives/use-server.md`

- Direct `@/lib/db` imports are allowed only in backend code:
  - Allowed: `app/api/**`, backend service libraries, tests, Prisma scripts.
  - Disallowed: dashboard/admin/portal/borrower pages, client components, and UI-facing server actions.

- Preserve existing `/api/v1` response envelopes from `lib/api/v1-envelope.ts`.
- Preserve tenant and branch scoping by sending `Authorization`, `X-Tenant-Slug`, and `X-Branch-Id` from the API client.
- Keep CORS in `lib/cors.ts` and `middleware.ts`; only extend it if external frontend deployment is introduced later.
- Do not physically split repos/services in this phase.

## Test Plan

- Runtime prerequisite:
  - Confirm Browser Use/Codex Node runtime is `v22.22.0` or newer before browser validation. Local shell currently reports `v22.22.2`.
  - Rerun the browser-based visual check after implementation.

- Static boundary checks:
  - Add a script/test that fails when `@/lib/db` appears in frontend route/page/action files outside approved backend paths.
  - Add coverage that no converted UI file imports old action modules.

- Automated checks:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run db:validate`
  - `npm run test:ci`
  - Existing focused tests as modules migrate, especially `test:e2e-features`, `test:dashboard-kpi-unit`, `test:gps`, and accounting tests.

- API regression:
  - For each converted module, test equivalent `/api/v1` happy path, unauthorized request, wrong tenant/branch request, and validation failure.
  - Verify old web behavior matches new API behavior for create/list/detail/update/action flows.

- Browser/E2E:
  - Start app with seeded DB.
  - Run Playwright role map and migrated module specs.
  - Perform Browser Use visual smoke checks for login, portal, dashboard, loans, customers, collection, and accounting overview.

## Assumptions

- Separation target is **API boundary first**, not immediate separate deployments.
- Flutter mobile remains unchanged.
- `/api/v1` remains the canonical backend API.
- Separate frontend/backend hosting can be planned after this migration once direct frontend DB access is eliminated.
