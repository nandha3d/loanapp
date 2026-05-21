# Module Slug Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move protected dashboard routes from flat paths to `/{module}/{page}` paths with the URL module slug as the routing authority.

**Architecture:** Add shared module path helpers, make middleware parse module-prefixed paths, move the dashboard layout and pages under `app/(dashboard)/[module]/`, and use module-aware links/redirects throughout the dashboard surface. Keep `/portal`, `/admin`, `/borrower`, `/api`, and `/login` outside the module slug.

**Tech Stack:** Next.js 16 App Router, React Server Components, NextAuth middleware, TypeScript, existing `tsx` assertion tests.

---

### Task 1: Red Tests For Module Slug Semantics

**Files:**
- Modify: `tests/moduleRoutes.test.ts`
- Modify: `tests/proxyPublicPaths.test.ts`

- [ ] **Step 1: Write failing module route tests**

Add assertions that `modulePath('microlending', '/dashboard')` returns `/microlending/dashboard`, that `parseModulePath('/autofinance/vehicles/1')` returns `{ module: 'autofinance', page: '/vehicles/1' }`, that module-prefixed paths are enabled only when the slug module is allowed, and that incompatible pages such as `/microlending/vehicles` are rejected.

- [ ] **Step 2: Write failing middleware tests**

Add assertions that agents redirect from `/microlending/reports` to `/microlending/collection`, agents redirect customer edit URLs inside the same module, developers may access `/microlending/dashboard`, and legacy flat developer dashboard paths still redirect to `/admin`.

- [ ] **Step 3: Run tests and confirm RED**

Run: `npm run test:proxy-public && npx tsx tests/moduleRoutes.test.ts`

Expected: FAIL because the helper functions and module-prefixed middleware behavior are missing.

### Task 2: Shared Module Path Helpers

**Files:**
- Modify: `types/modules.ts`
- Create: `components/layout/DashboardLink.tsx`
- Create: `components/layout/useDashboardPath.ts`

- [ ] **Step 1: Implement route parsing**

Add `MODULE_SLUGS`, `modulePath`, `parseModulePath`, `isModuleKey`, and `prefixDashboardHref`. Update `isRouteEnabledForModules` to strip a valid module slug before checking page support while also requiring the URL module to be enabled.

- [ ] **Step 2: Implement dashboard link helpers**

Create a client `DashboardLink` wrapper around `next/link` and a `useDashboardPath` hook so client components can safely prefix dashboard-relative paths using `params.module`.

- [ ] **Step 3: Run tests and confirm GREEN for helpers**

Run: `npx tsx tests/moduleRoutes.test.ts`

Expected: PASS.

### Task 3: Middleware And Entry Redirects

**Files:**
- Modify: `middleware.ts`
- Modify: `app/page.tsx`
- Modify: `app/portal/actions.ts`
- Modify: `app/portal/page.tsx`
- Modify: `app/portal/AppSelectorClient.tsx`
- Modify: selected `/admin/*` fallback redirects

- [ ] **Step 1: Update role redirects**

Use `parseModulePath` in middleware. Preserve `/portal`, `/admin`, `/borrower`, `/api`, and public behavior. Redirect blocked module pages back into the same module.

- [ ] **Step 2: Update app selection and root routing**

Make app selection redirect to `/${appType}/dashboard`. Root redirects admins/agents with one active module to their module page and multi-module users to `/portal`.

- [ ] **Step 3: Update portal fallback links**

Make portal quick access use the first enabled module or `microlending`, and keep admin/system links flat.

- [ ] **Step 4: Run middleware tests**

Run: `npm run test:proxy-public`

Expected: PASS.

### Task 4: Dashboard Route Move And Layout

**Files:**
- Move: dashboard page folders into `app/(dashboard)/[module]/`
- Move: `app/(dashboard)/layout.tsx` to `app/(dashboard)/[module]/layout.tsx`
- Modify: `app/(dashboard)/[module]/layout.tsx`
- Modify: `lib/tenant.ts`

- [ ] **Step 1: Move route folders**

Move page-bearing dashboard folders into `[module]` and leave non-route shared actions only where imports expect them.

- [ ] **Step 2: Update layout**

Await `params`, validate `params.module`, compute allowed modules from role and branch, redirect disallowed modules to the first allowed module, pass `modulePrefix`, and use `getAppConfig(requestedModule)`.

- [ ] **Step 3: Update tenant app type resolution**

Make `getUserAppType` read the first URL segment first when it is a known module, then fall back to legacy cookie/session behavior.

### Task 5: Dashboard Links And Redirects

**Files:**
- Modify: `components/layout/Sidebar.tsx`
- Modify: `components/layout/Topbar.tsx`
- Modify: `components/layout/SubscriptionExpiredModal.tsx`
- Modify: dashboard pages/actions under `app/(dashboard)/[module]/`

- [ ] **Step 1: Prefix sidebar links**

Accept `modulePrefix`, build dashboard nav links as `/${module}/page`, and strip the current module for active-state checks.

- [ ] **Step 2: Prefix common layout links**

Use `DashboardLink` in Topbar and subscription modal for module-local paths.

- [ ] **Step 3: Prefix dashboard page links**

Use `DashboardLink` in dashboard route files so hard-coded dashboard links resolve under the active module. Leave `/api`, `/admin`, `/portal`, `/borrower`, and external links untouched.

- [ ] **Step 4: Prefix dashboard redirects and notifications**

Use `modulePath(await getUserAppType(), ...)` for dashboard redirects, `revalidatePath`, and stored notification links that should open inside a module.

### Task 6: Verification

**Files:**
- No production files unless verification reveals a bug.

- [ ] **Step 1: Type and route tests**

Run: `npm run test:proxy-public && npx tsx tests/moduleRoutes.test.ts && npm run typecheck`

- [ ] **Step 2: Browser visual check**

Confirm Node is `v22.22.0` or newer, start the app, open a module-prefixed page in a browser, and verify the layout renders without blank content or flat dashboard navigation.

- [ ] **Step 3: Final diff review**

Run: `git diff --stat` and inspect changed files for accidental unrelated edits.
