# User Management Realignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the role, branch, and module-access redesign described in `zolofund_end_to_end_markdown_docs/USER_MANAGEMENT_REALIGNMENT.md`.

**Architecture:** Move active business context from an app-type cookie to an active branch cookie. Persist branch module grants in Prisma, derive per-user module access through `lib/branch.ts`, and route all server actions/API queries through active tenant, branch, and module context.

**Tech Stack:** Next.js 16 App Router/Server Actions, NextAuth v5, Prisma 5 with MySQL, React 19, TypeScript.

---

### Task 1: Schema and Type Foundation

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `types/next-auth.d.ts`
- Create: `types/modules.ts`
- Verify: `npm run db:validate`

**Steps:**
1. Add `Branch.superadminId`, `Branch.enabledModules`, `BranchRequest`, `UserBranchModule`, and model back-relations.
2. Extend NextAuth JWT/session declarations with `activeBranchId`.
3. Add canonical module keys and route mapping.
4. Run Prisma validation/generation and fix schema errors before moving on.

### Task 2: Branch Context Helpers

**Files:**
- Create: `lib/branch.ts`
- Modify: `lib/tenant.ts`
- Modify: `lib/serverActionAuth.ts`
- Modify: `lib/moduleGate.ts`

**Steps:**
1. Add branch resolution and module lookup helpers.
2. Replace superadmin `active_app_type` lookup with branch-derived app type fallback.
3. Add `branchId` and `modules` to server-action context.
4. Make module gating use active branch modules.

### Task 3: Middleware/Proxy Role Rules

**Files:**
- Modify: `middleware.ts`
- Create: `proxy.ts`
- Modify/Test: `tests/proxyPublicPaths.test.ts`
- Verify: `npm run test:proxy-public`

**Steps:**
1. Add pure route guard helpers/tests for developer and agent access.
2. Allow agents into loans/customers while keeping reporting/settings blocked.
3. Forward `active_branch_id` as `x-zolofund-active-branch`.
4. Re-export middleware through `proxy.ts` for Next 16/test compatibility.

### Task 4: Branch Switcher and Request Flow

**Files:**
- Create: `app/(dashboard)/actions/branch.ts`
- Create: `components/layout/BranchSwitcher.tsx`
- Modify: `components/layout/Topbar.tsx`
- Modify: `app/(dashboard)/layout.tsx`
- Create: `app/(dashboard)/branch-requests/actions.ts`
- Create: `app/(dashboard)/branch-requests/page.tsx`
- Create: `app/admin/branch-requests/actions.ts`
- Create: `app/admin/branch-requests/page.tsx`

**Steps:**
1. Add a superadmin-only server action to set `active_branch_id`.
2. Mount a client branch selector in the dashboard topbar.
3. Add superadmin branch request submission/list page.
4. Add developer review actions/page with approve/reject forms.

### Task 5: Admin Module Assignment and Portal Branch Management

**Files:**
- Modify: `app/admin/actions.ts`
- Modify: `app/admin/branches/page.tsx`
- Modify: `app/admin/branches/BranchesClient.tsx`
- Modify: `app/admin/users/page.tsx`
- Modify: `app/admin/users/UsersClient.tsx`

**Steps:**
1. Let developers assign branch owners and enabled modules.
2. Let superadmins assign module subsets to admin users.
3. Validate assigned modules are a subset of branch modules.

### Task 6: Feature Permissions and Branch Scoping

**Files:**
- Modify: `app/(dashboard)/loans/actions.ts`
- Modify: `app/(dashboard)/customers/actions.ts`
- Modify: `components/layout/Sidebar.tsx`
- Modify: `lib/apiAuth.ts`
- Modify: dashboard/report/customer/collection API routes and pages with tenant-only queries.

**Steps:**
1. Allow agents to create loans and customers, using server-derived branch context.
2. Hide sidebar module routes using active modules.
3. Scope superadmin queries to the active branch.
4. Replace tenant subscription module checks in feature actions with branch module gates.

### Task 7: Seed and Verification

**Files:**
- Modify: `prisma/seed.ts`

**Steps:**
1. Add developer user and sample branch module data.
2. Run Prisma validation/generation.
3. Run targeted tests, lint/build where feasible.
4. Record any browser verification limitation due the documented Browser Use Node runtime mismatch.
