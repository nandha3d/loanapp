# ROLE_MANAGEMENT_AUDIT.md
# Complete Hierarchy Audit & Correction Guide

> Based on codebase inspection of `loanapp_source_20260517_121626.zip`.
> Each section states what is correct, what is wrong, and exactly what to fix.
> No code snippets — this is a specification document for the developer.

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Correctly implemented |
| ⚠️ | Partially implemented — needs adjustment |
| ❌ | Missing or broken — must be fixed |

---

## 1. Data Model (Prisma Schema)

### 1.1 `Branch` model

| Check | Status | Notes |
|---|---|---|
| `enabledModules` field exists | ✅ | Stored as `LongText` with JSON array |
| `superadminId` FK to `User` exists | ✅ | Relation `SuperadminBranches` wired correctly |
| Back-relation `branchRequests` exists | ✅ | |
| Back-relation `userModules` exists | ✅ | |
| `deletedAt` soft-delete field | ❌ | Branch has no soft-delete. If a developer deactivates a branch, it uses `status = 'inactive'` only. Add `deletedAt DateTime?` to make it consistent with Tenant, User, Customer, Loan. |

### 1.2 `BranchRequest` model

| Check | Status | Notes |
|---|---|---|
| Model exists with all required fields | ✅ | |
| `requestedModules` stored as `LongText` | ✅ | Normalised on read via `normalizeModuleList()` |
| Relation to `Tenant` exists | ✅ | |
| Relation to requesting `User` | ✅ | |
| Relation to reviewing `User` | ✅ | |
| Notification fired on submit | ✅ | `branch_request` type sent to developer |
| Notification fired on review | ✅ | Reverse notification sent to superadmin's tenant |
| `branchId` nullable (supports new branch requests) | ✅ | |

### 1.3 `UserBranchModule` model

| Check | Status | Notes |
|---|---|---|
| Model exists | ✅ | |
| Unique constraint on `[userId, branchId]` | ✅ | |
| `enabledModules` stored as `LongText` | ✅ | |
| No `tenantId` on the model | ⚠️ | Safe for now because `branchId` implies `tenantId`, but makes direct queries slightly harder to audit. Consider adding `tenantId` as a denormalised index column in the future. |

### 1.4 `User` model

| Check | Status | Notes |
|---|---|---|
| `superadminBranches` back-relation | ✅ | |
| `branchRequestsMade` back-relation | ✅ | |
| `branchRequestsReviewed` back-relation | ✅ | |
| `userBranchModules` back-relation | ✅ | |
| `appType` field retained for agent/admin rows | ✅ | |
| Developer user has `branchId = null` | ✅ | Enforced by the fact developer has no branch |
| `totpSecret` present | ✅ | |
| `deletedAt` soft-delete | ✅ | |

### 1.5 `TenantSubscription` model

| Check | Status | Notes |
|---|---|---|
| `enabledModules` field exists | ✅ | Stored as `LongText` |
| `plan` field (trial/starter/pro/enterprise) | ✅ | |
| `maxActiveLoans`, `maxAgents` limits | ✅ | |
| `gracePeriodEnd` exists | ✅ | |
| **Relationship between subscription modules and branch modules is undefined** | ❌ | The `TenantSubscription.enabledModules` represents the overall platform plan — what the developer has permitted the tenant to use at all. The `Branch.enabledModules` is the subset of those modules active on a specific branch. Currently there is no enforced constraint that `Branch.enabledModules ⊆ TenantSubscription.enabledModules`. The developer can set branch modules to anything regardless of subscription. This must be enforced — see Section 8. |

### 1.6 `SystemNotification` model

| Check | Status | Notes |
|---|---|---|
| `type` field supports `branch_request` | ✅ | Used by branch request notifications |
| `type` field supports `loan_review` | ✅ | Used when agent creates a loan |
| No `userId` field — notifications are tenant-scoped only | ⚠️ | Notifications are broadcast to all users in the tenant, not targeted to specific roles. A `loan_review` notification goes to everyone in the tenant, including other agents. Should be scoped to admins of that branch only. Add a `branchId` and optional `targetRole` field to `SystemNotification` so notifications can be filtered by the recipient's branch and role. |

---

## 2. Type Definitions

### `types/modules.ts`

| Check | Status | Notes |
|---|---|---|
| `ALL_MODULES`, `MODULE_LABELS`, `MODULE_ROUTES` defined | ✅ | |
| `normalizeModuleList()` handles `LongText` JSON strings | ❌ | `normalizeModuleList()` only handles arrays. The DB stores modules as a JSON string in a `LongText` column. When Prisma returns the raw value it is a string like `'["microlending","autofinance"]'`, not a parsed array. The function must `JSON.parse()` the string first if `typeof value === 'string'`. Confirm this works in production — if it is silently returning `[]` everywhere, no modules will ever show. |
| `isRouteEnabledForModules()` exported | ✅ | Used in dashboard layout |
| `moduleForRoute()` exported | ✅ | |

### `types/index.ts` and `types/next-auth.d.ts`

| Check | Status | Notes |
|---|---|---|
| `activeBranchId` added to `Session` and `JWT` | ❌ | The types still show only `branchId`. `activeBranchId` was planned in the guide but is not in the type declarations. The branch switcher stores context in a cookie read at request time, so no JWT change is strictly needed — but the type declarations should at minimum reflect that `branchId` is `null` for superadmin (they use the cookie), which is not documented. Add a comment to the type making this explicit. |

---

## 3. `lib/branch.ts` Helpers

| Check | Status | Notes |
|---|---|---|
| `getActiveBranchId()` resolves for superadmin from cookie/header | ✅ | Reads `x-zolofund-active-branch` header first, then falls back to cookie |
| Auto-falls back to first branch if no cookie | ✅ | Queries first branch by name |
| Validates the cookie branch belongs to the superadmin | ✅ | Checks `superadminId = user.id` |
| `getBranchEnabledModules()` returns parsed modules | ⚠️ | Calls `normalizeModuleList(branch?.enabledModules)`. If `enabledModules` comes back as a raw JSON string from the DB (not parsed), this returns `[]`. This is the same bug as in `types/modules.ts`. Verify `normalizeModuleList` handles raw strings. |
| `getUserModulesForBranch()` falls back to branch modules | ✅ | Falls back if no `UserBranchModule` row exists |
| `getActiveModules()` returns `[]` for developer | ✅ | |
| `getSuperadminBranches()` filters by `superadminId` and `status = active` | ✅ | |
| Agent gets their fixed `branchId` from session | ✅ | |
| Admin gets their fixed `branchId` from session | ✅ | |

---

## 4. `lib/tenant.ts` — `getUserAppType()`

| Check | Status | Notes |
|---|---|---|
| `active_app_type` cookie still checked first | ⚠️ | The old cookie `active_app_type` is still read before the new branch-derived logic. If any old session has this cookie set, it will override the correct branch-derived appType. This cookie should be explicitly cleared on login and the check removed from this function. |
| Superadmin derives appType from active branch's first module | ✅ | |
| Developer returns `microlending` as default | ✅ | |
| Subscription check skipped for `/branch-requests` | ✅ | |

---

## 5. Middleware & Auth

### `middleware.ts`

| Check | Status | Notes |
|---|---|---|
| `AGENT_BLOCKED` no longer includes `/loans` or `/customers` | ✅ | Agents can now access both |
| Developer redirected to `/admin` for all non-admin paths | ✅ | |
| Superadmin allowed into `/admin/users`, `/admin/branches`, `/admin/branch-requests` | ✅ | |
| Superadmin blocked from `/admin/billing` and root `/admin` | ✅ | Only those three paths are explicitly whitelisted |
| Admin blocked from `/portal` | ✅ | |
| Agent blocked from `/approvals` | ✅ | Added to `AGENT_BLOCKED` |
| Agent blocked from `/dashboard` | ✅ | |
| Agent can edit their own new customer (`/customers/new`) | ✅ | |
| Agent blocked from editing existing customers directly | ✅ | Regex check for `/customers/[id]/edit` |
| `active_branch_id` cookie forwarded as header | ✅ | `x-zolofund-active-branch` set in `nextWithTenantHeaders` |
| **Superadmin accessing `/portal` — not blocked** | ⚠️ | The middleware `SUPERADMIN_ONLY` array contains `/portal`, meaning non-superadmin roles are blocked from portal. But the developer should also be able to reach `/portal`. Verify the portal redirect logic does not block developers from `/portal`. Currently `SUPERADMIN_ONLY = ['/portal']` and the developer bypass check runs first, so this may be fine — but it should be explicitly tested. |
| **No module-level middleware enforcement** | ⚠️ | Module-gating at the middleware layer only happens in the dashboard layout via `isRouteEnabledForModules`. If a user crafts a direct URL to `/vehicles` when their branch only has `microlending`, the middleware will not block them — the layout redirect will. This is acceptable but should be noted. Consider moving the check earlier. |

### `lib/auth.ts` / JWT callbacks

| Check | Status | Notes |
|---|---|---|
| JWT carries `role`, `tenantId`, `branchId`, `appType` | ✅ | |
| `secureCookie` fallback for Hostinger | ✅ | |
| Rate limiting on login | ✅ | |
| TOTP validation | ✅ | |
| Developer role resolves correctly on login | ⚠️ | There is no special tenant handling for the developer user at login. The developer user has a `tenantId` pointing to the platform tenant. Confirm the developer's `tenantId` is a valid tenant row (e.g. a `platform` tenant) so that `getCurrentTenantId()` does not throw when resolving. If the developer logs in and their `tenantId` doesn't exist in the DB, every page will error. |

---

## 6. Branch Switcher

### `components/layout/BranchSwitcher.tsx`

| Check | Status | Notes |
|---|---|---|
| Renders a `<select>` dropdown | ✅ | |
| Hidden if only one branch | ✅ | `branches.length <= 1` check |
| Calls `switchActiveBranch` server action on change | ✅ | |
| Calls `router.refresh()` after switch | ✅ | Full context reload |
| Auto-sets cookie to first branch if no active branch | ✅ | Done in `useEffect` |
| Optimistic UI rollback on failure | ✅ | Reverts to `activeBranchId` if action fails |
| **No branch name displayed in topbar when only one branch** | ⚠️ | When a superadmin has only one branch, the dropdown is hidden entirely. The branch name is nowhere visible in the UI. The superadmin cannot tell which branch context they are in. Render the branch name as a static label when there is only one branch. |

### `app/(dashboard)/actions/branch.ts` — `switchActiveBranch`

| Check | Status | Notes |
|---|---|---|
| Validates superadmin role | ✅ | |
| Validates branch belongs to superadmin's tenant and has `superadminId = user.id` | ✅ | |
| Sets `active_branch_id` cookie | ✅ | `httpOnly`, `sameSite: lax`, `secure` in production |
| Returns branch name on success | ✅ | |

### Dashboard layout `app/(dashboard)/layout.tsx`

| Check | Status | Notes |
|---|---|---|
| Loads superadmin branches and active branch | ✅ | |
| Passes branches and activeBranchId to `BranchSwitcher` | ✅ | |
| Subscription expiry banner shown | ✅ | |
| Module-gated redirect based on active modules | ✅ | `isRouteEnabledForModules()` check |
| **`enabledModules` passed to Sidebar is from `getEnabledModules(tenantId)` — not from the active branch** | ❌ | The layout calls `getEnabledModules(tenantId)` which goes through `moduleGate` → `getActiveModules()` → `branch.ts`. For superadmin, this should correctly derive from the active branch. But the result is also passed to `Sidebar` as a prop named `enabledModules`. Trace this: if `getActiveModules()` is returning the right modules, Sidebar should work. If it is returning `[]` (due to the `normalizeModuleList` string bug described earlier), the sidebar will show no module-gated items. This is a critical path — verify end-to-end that when Manoj switches to the Erode branch (vehicles+chitfunds), the Sidebar shows Vehicles and Chits links, not Loans. |

---

## 7. Branch Request Flow

### Superadmin side — `app/(dashboard)/branch-requests/`

| Check | Status | Notes |
|---|---|---|
| Page is restricted to superadmin role | ✅ | Redirects to `/dashboard` if not superadmin |
| Shows list of own past requests with status | ✅ | |
| Form allows selecting existing branch or requesting new | ✅ | |
| Form requires at least one module selected | ✅ | Server-side validation |
| New branch request requires branch name | ✅ | Server-side validation |
| Notification sent to developer on submit | ✅ | `branch_request` type, links to `/admin/branch-requests` |
| **No link in sidebar to `/branch-requests`** | ❌ | The superadmin has no way to navigate to the branch request page unless they know the URL. Add a sidebar nav item `Branch Requests` visible only to superadmin. |
| **No validation that requested modules are within subscription plan** | ❌ | A superadmin can request any module combination, even ones not in their subscription. The developer sees this request and must manually check. Add a client-side warning on the form: "These modules are not in your current subscription plan: [list]. The developer may need to update your subscription first." |

### Developer side — `app/admin/branch-requests/`

| Check | Status | Notes |
|---|---|---|
| Page is restricted to developer role | ✅ | |
| Shows all pending requests across all tenants | ✅ | |
| Shows tenant name/slug, requestedBy, branch name, modules, reason | ✅ | |
| Approve creates new branch or updates modules | ✅ | `reviewBranchRequest` action handles both |
| Reject updates status without branch change | ✅ | |
| Notification sent back to superadmin's tenant on review | ✅ | |
| **No navigation link in admin sidebar to branch requests** | ❌ | The admin layout sidebar only shows `Master Users` and `Branches`. There is no link to `/admin/branch-requests` for the developer. Add it to the admin sidebar nav. |
| **Approved new branch has no `code` or `address`** | ⚠️ | When the developer approves a new branch, it is created with only `name` and `enabledModules`. The `code`, `address`, and `phone` fields are left empty. The developer should be able to fill these in during approval, or the superadmin should be prompted to complete the branch profile after creation. |

---

## 8. Subscription Plan — Developer Sets Plan for Superadmin

This was identified as incorrectly implemented. Here is the full audit.

### What the design requires

The developer sets a `TenantSubscription` plan for each superadmin's tenant. This plan defines the **ceiling** of what the tenant is allowed to do: maximum loans, maximum agents, and which modules are globally available. The `Branch.enabledModules` is then a **subset** of those subscription modules, assigned per branch by the developer (or via the branch request flow).

### Current state

| Check | Status | Notes |
|---|---|---|
| Developer can set plan, limits, and modules in `/admin/billing/[tenantId]` | ✅ | `updateSubscription` action exists and is developer-only |
| `TenantSubscription.enabledModules` is stored | ✅ | |
| Loan limit enforced via `checkLimit('loans')` | ✅ | |
| Agent limit enforced via `checkLimit('agents')` | ✅ | |
| **`Branch.enabledModules` is not validated against `TenantSubscription.enabledModules`** | ❌ | When the developer approves a branch request or directly creates/edits a branch, there is no check that the requested modules are within the tenant's subscription plan. A tenant on a `microlending`-only plan could have a branch approved with `autofinance` modules. Fix: in `reviewBranchRequest` and `createBranch` actions, fetch the tenant's `TenantSubscription.enabledModules` and reject any branch module that is not in that list. |
| **`UserBranchModule` is not validated against `Branch.enabledModules`** | ❌ | In `assignAdminModules`, the check verifies branch modules correctly — but only if `branch.enabledModules` is properly parsed. If the `normalizeModuleList` string bug is present, this check always passes because `branchModules` is `[]` and `data.modules.filter(m => !branchModules.includes(m))` returns everything as invalid, blocking all assignments. Fix the string parsing bug first. |
| **Subscription modules vs branch modules confusion in Users UI** | ❌ | In `UsersClient.tsx`, the superadmin summary card shows `modules` derived from `saSubscription.enabledModules` (subscription-level), not from branch modules. This means the UI tells the developer "this superadmin has Micro Lending and Auto Finance" based on their plan — but the individual branches might have different subsets. The UI should show subscription modules separately from branch modules. Specifically: show the plan-level modules as "Permitted by plan" and each branch's modules separately under that branch row. |
| **`updateTenantSubscription` exists in two places** | ⚠️ | Both `app/admin/actions.ts` and `app/admin/billing/billingActions.ts` export an `updateSubscription` / `updateTenantSubscription` action that does the same thing. Only one should exist. The one in `billingActions.ts` is used by the `/admin/billing/[tenantId]` page; the one in `admin/actions.ts` is called from `UsersClient`. Consolidate to one action. |
| **No subscription creation when a new superadmin is created** | ❌ | In `manageMasterUser` action, when a new superadmin is created, no `TenantSubscription` row is automatically created. This means the new tenant has no subscription, and `assertTenantSubscriptionAccess()` skips the check entirely (it returns early when `sub` is null). The developer must manually go to `/admin/billing` and create a subscription. This is an acceptable manual flow (per decision 1 — tenant onboarding is always manual), but it should be surfaced clearly in the UI: after creating a superadmin, show a prompt "Remember to set up this tenant's subscription in Billing." |

---

## 9. Admin Module Assignment

### `assignAdminModules` in `app/admin/actions.ts`

| Check | Status | Notes |
|---|---|---|
| Only superadmin or developer can call this | ✅ | |
| Verifies admin user belongs to the branch | ✅ | |
| Upserts `UserBranchModule` row | ✅ | |
| **Missing validation that modules ⊆ branch modules** | ❌ | The action has this check in theory, but if `normalizeModuleList` returns `[]` due to the string parsing bug, the `invalid` array will contain all requested modules and block every assignment. Fix the parsing bug. After that, this validation will work correctly. |
| UI in `UsersClient.tsx` shows module checkboxes per admin | ✅ | |
| Checkboxes are disabled for modules not in the branch | ✅ | `disabled={!enabled}` on unchecked modules |
| **Module assignment UI is inside the Users page, not the Branches page** | ⚠️ | The superadmin needs to first select an admin user, then see a branch dropdown, then assign modules. This flow is nested inside a large modal. Consider moving the module assignment to the admin user's profile page for clarity, or at minimum label the section clearly: "Module access within this branch." |

---

## 10. Agent: Loan and Customer Creation

### Loan creation — `app/(dashboard)/loans/actions.ts`

| Check | Status | Notes |
|---|---|---|
| `agent` role allowed in `createLoan` | ✅ | Roles checked: `['admin', 'superadmin', 'developer', 'agent']` |
| Agent-created loan set to `status: 'pending_review'` | ✅ | |
| `branchId` comes from `getActiveBranchId()` (session context, not form) | ✅ | |
| Notification sent to branch admins on agent loan creation | ✅ | Type `loan_review` |
| **Loan with `pending_review` status appears in `/loans` list** | ⚠️ | The loans list page does not filter by status by default — it shows all loans including `pending_review`. An admin scrolling through loans will see pending loans mixed with active ones. Add a status filter tab for "Pending Review" loans and visually distinguish them in the table with a badge. |
| **No approval action for `pending_review` loans in `/approvals`** | ❌ | The `reviewRequest` action in `approvals/actions.ts` handles `customer_edit` and `edit_collection` request types. There is no handler for `loan_review` or `loan_approval` type. Agent-created loans with `pending_review` status fire a notification, but there is no UI for the admin to approve or reject the loan from the approvals page. The loan stays in `pending_review` forever. Fix: add a `loan_approval` case in `reviewRequest` that sets `loan.status = 'active'` on approve, or `loan.status = 'rejected'` on reject. Also add the pending loan list to the `/approvals` page UI. |
| **Agent can create a loan for any customer in the branch** | ⚠️ | There is no check that the customer the agent selects belongs to the agent's assigned route. An agent could create a loan for a customer assigned to a different agent's route. This may be intentional but should be confirmed. |

### Customer creation — `app/(dashboard)/customers/actions.ts`

| Check | Status | Notes |
|---|---|---|
| `agent` role allowed to create customer | ✅ | |
| Agent-created customer set to `status: 'pending_review'` | ✅ | |
| Admin approves via `approveCustomerCreation` action | ✅ | |
| `branchId` set from context, not from form | ✅ | |
| **Pending customer is visible in the approvals page** | ⚠️ | Confirm that the `/approvals` page shows `pending_review` customers for admin review. The `approvalRequest` table stores `customer_edit` type — but agent-created customers in `pending_review` status are not stored as `ApprovalRequest` rows; they are just raw Customer rows with a pending status. The admin sees them through `approveCustomerCreation` which queries `Customer` directly. This is inconsistent with the loan flow (which uses notifications). Document or unify the approach. |

---

## 11. Dashboard Data Scoping

### `app/api/dashboard/route.ts`

| Check | Status | Notes |
|---|---|---|
| Uses `scopedBranchWhere(context)` | ✅ | Adds `branchId` filter when context has one |
| Agent count does not use `branchId` filter | ⚠️ | `activeAgents` query filters by `tenantId`, `appType`, and `role = agent` but does NOT include `branchId`. On the superadmin's dashboard for Erode branch, they will see the agent count for the entire tenant across all branches. Fix: include `branchId` in the agent count query. |
| `recentLoans` scoped to branch | ✅ | Uses `loanWhere` which includes `scopedBranchWhere` |

### Other API routes

| Route | Branch-scoped | Notes |
|---|---|---|
| `/api/customers` | ✅ | Uses `scopedBranchWhere` |
| `/api/loans` | ✅ | Uses `scopedBranchWhere` |
| `/api/collection` | ✅ | Uses `scopedBranchWhere` |
| `/api/reports` | ⚠️ | Needs verification — read the reports route and confirm `branchId` is included in the query filters |
| `/api/penalties` | ⚠️ | Needs verification — this was flagged as missing `appType` filter in the original `CONCERNS.md`. Verify `branchId` is also now included |
| `/api/notifications` | ⚠️ | Notifications are tenant-wide — no `branchId` filtering exists. When superadmin is on Erode branch, they will see notifications from Namakkal too. After adding `branchId` to `SystemNotification` (see Section 1.6), filter notifications by active branch. |

---

## 12. Module Gating — `lib/moduleGate.ts`

| Check | Status | Notes |
|---|---|---|
| `assertModuleEnabled()` uses `getActiveModules()` | ✅ | Branch-aware |
| `isModuleEnabled()` implemented | ✅ | |
| `getEnabledModules()` deprecated wrapper exists | ✅ | Forwards to `getActiveModules()` |
| `requireModule()` deprecated wrapper exists | ✅ | |
| `assertModuleEnabled` called in vehicle actions | ✅ | `requireModule` called at top of vehicle actions |
| `assertModuleEnabled` called in chit actions | ✅ | |
| `assertModuleEnabled` called in loan actions for non-microlending | ⚠️ | Loan creation does not call `assertModuleEnabled('microlending')`. If `microlending` is removed from a branch, agents can still create loans. Add the module check at the start of `createLoan`. |
| **Module removal read-only enforcement** | ❌ | Per the agreed decision: when a module is removed from a branch, existing data becomes read-only. Currently there is no read-only enforcement. If `microlending` is removed from Erode branch, the `assertModuleEnabled('microlending')` call in `createLoan` will throw and block new loan creation — which is correct. But the loan list page, customer list page, and collection page will also be blocked by the sidebar/layout module gate, hiding existing data entirely. The agreed behaviour was that existing data should remain visible but not editable. Fix: remove the module gate from list/read pages. Only apply `assertModuleEnabled` to create/edit/delete actions. The sidebar can hide the nav link, but if someone navigates directly to `/loans` in a branch without `microlending`, they should see read-only data, not a redirect. |

---

## 13. UI Corrections Required

This section collects all UI issues observed across the four roles.

### Developer UI (`/admin`)

| Issue | Status | Fix |
|---|---|---|
| No navigation link to `/admin/branch-requests` in sidebar | ❌ | Add "Branch Requests" link to `app/admin/layout.tsx` nav, visible to developer only |
| Admin layout allows superadmin in but sidebar shows same items as developer | ⚠️ | When a superadmin is at `/admin/users`, the sidebar shows "Branches" — but that page is developer-only. The sidebar should conditionally hide Branches for superadmin. |
| No count badge on branch requests nav item | ⚠️ | Add a pending count badge to the Branch Requests nav item so the developer knows when there are requests awaiting review |
| Subscription form at `/admin/billing/[tenantId]` allows setting branch-level modules | ⚠️ | The billing form sets `TenantSubscription.enabledModules`. This should be clearly labelled as "Plan-level permitted modules" — not branch modules. Currently the label is just "Enabled Modules" which is ambiguous. |
| Creating a new superadmin gives no prompt to set up subscription | ❌ | After `manageMasterUser` creates a superadmin, display a message: "Subscription not yet configured for this tenant. Go to Billing to set up their plan." |

### Superadmin UI (`/dashboard`, `/admin/users`, `/branch-requests`)

| Issue | Status | Fix |
|---|---|---|
| Branch switcher hidden when superadmin has only one branch | ⚠️ | Show the branch name as a static non-interactive label in the topbar when there is only one branch. The superadmin should always know which branch context they are in. |
| No sidebar link to `/branch-requests` | ❌ | Add "Branch Requests" to the sidebar nav, visible to superadmin only. Place it under the Account section. |
| Module assignment UI is inside a large modal in Users page | ⚠️ | The flow is confusing — a superadmin must open a user, switch to "Module Access" tab, select a branch, then assign modules. Consider a dedicated page at `/admin/users/[id]/modules` or at minimum split the modal into clearly labelled steps. |
| Superadmin can see `/admin/billing` in sidebar | ❌ | The sidebar in `admin/layout.tsx` renders a "Billing" link that points to `/admin/billing`. This page is developer-only. Even though the middleware would redirect a superadmin away, the link should not be visible to superadmin. The sidebar already has a conditional `{userRole === 'developer' && ...}` for the Branches link — apply the same pattern to Billing. |
| Subscription page (`/subscription`) shows the plan but superadmin cannot edit it | ✅ | This is correct — the developer sets the plan. The superadmin sees it read-only. Verify this is the actual behaviour. |
| `/portal` link in sidebar footer for superadmin | ⚠️ | The sidebar footer has a "Switch App" link to `/portal` for superadmin. With the new model, `/portal` is a developer-level area. Superadmin should not have a shortcut there. Remove this link or replace it with a "Branch Requests" shortcut. |

### Admin UI (`/dashboard`)

| Issue | Status | Fix |
|---|---|---|
| Admin cannot see which modules they have been assigned | ❌ | The admin user has a `UserBranchModule` row defining their permitted modules, but there is no UI where the admin can see what their module access is. Add a read-only section to the admin's profile settings page showing "Your permitted modules in this branch: [list]." |
| Approvals page does not show pending loans (agent-created) | ❌ | The `/approvals` page shows `ApprovalRequest` records (customer edits, collection edits) but not `pending_review` loans. Add a "Pending Loans" section to the approvals page showing loans with `status = 'pending_review'` in the admin's branch. Provide Approve/Reject buttons. |
| No visual distinction between `pending_review` and `active` loans in loan list | ⚠️ | Add a coloured badge for `pending_review` status in the loans table. Also filter pending loans to be visible only to admin/superadmin — agents should only see their own submitted loans. |

### Agent UI

| Issue | Status | Fix |
|---|---|---|
| Agent can reach `/loans` (correct per new model) but no explanation of pending review | ⚠️ | After an agent creates a loan, the success message should say "Loan submitted for admin review" rather than a generic success. The agent should be able to see their submitted loans with a "Pending Review" badge on the loan list. |
| Agent cannot tell which customers need approval | ⚠️ | Agent-created customers with `pending_review` status should be visually distinct on the customer list, with a note that admin approval is needed before the customer is active. |

---

## 14. Four Decisions — Implementation Audit

### Decision 1: Tenant signup is always manual via developer portal

| Check | Status | Notes |
|---|---|---|
| No self-serve signup page exists | ✅ | |
| Tenant created by developer via `manageMasterUser` (creates superadmin + tenant) | ⚠️ | The `manageMasterUser` action creates a new tenant ID inline but does not create a proper `Tenant` row first. It generates a random `tenantId` string (`tnt_...`) but there is no `prisma.tenant.create()` call in the action. A user is created with a `tenantId` that has no corresponding row in the `tenants` table. This will cause foreign key errors. Fix: when `role === 'superadmin'` and `id` is null (new user), first create a `Tenant` row, then create the `User` with the resulting `tenant.id`. Also create a default `TenantSubscription` row (plan: trial) at the same time. |

### Decision 2: Branch request notifications via in-app notifications

| Check | Status | Notes |
|---|---|---|
| `branch_request` notification type sent to developer on superadmin submit | ✅ | |
| Notification sent back to superadmin's tenant on approve/reject | ✅ | |
| Developer sees notification in their dashboard | ⚠️ | The developer is on the `/admin` layout, which does not load `SystemNotification` records. The notification is stored in the DB but the developer has no notification bell in the admin UI. Add a notification indicator to the admin topbar for the developer so they know when branch requests arrive. |
| **Notifications are not targeted to the correct role** | ❌ | The `loan_review` notification is stored in `SystemNotification` with `tenantId` only. All users in the tenant (including agents) will see "Agent submitted loan X for approval" in their notification list. Notifications for loan reviews should only appear for admins and superadmins of that branch. This requires the `branchId` and `targetRole` fields on `SystemNotification` described in Section 1.6. |

### Decision 3: Agent loan creation → pending_review → admin approves

| Check | Status | Notes |
|---|---|---|
| Agent-created loan gets `status: 'pending_review'` | ✅ | |
| Notification of type `loan_review` sent | ✅ | |
| **No approval action exists for pending_review loans** | ❌ | As described in Section 10, there is no handler in `approvals/actions.ts` for approving a loan. The loan sits in `pending_review` with no mechanism to change it to `active`. This is the most critical gap in the implementation. Must be fixed before agents are allowed to create loans. |
| **Pending loans not visible in approvals page UI** | ❌ | Admins have no UI surface to review and approve/reject pending loans. The approvals page must be extended. |

### Decision 4: Module removal — existing data becomes read-only

| Check | Status | Notes |
|---|---|---|
| `assertModuleEnabled` blocks create/edit actions when module is removed | ✅ | Partially — vehicle and chit actions have this check |
| List/read pages are blocked too (sidebar hides the nav item) | ⚠️ | This goes against the agreed decision. The nav item disappears, but if a user navigates directly to `/vehicles` in a branch where `autofinance` is removed, the layout's `isRouteEnabledForModules` check redirects them away. Existing vehicle data is completely inaccessible, not read-only. The layout redirect must be changed: if the module is removed but data exists, allow read-only access. Block only create/edit actions via `assertModuleEnabled`. |
| No read-only indicator shown to users when a module has been removed | ❌ | When a user is viewing data from a removed module (in the read-only scenario above), there should be a banner: "This module has been removed from your branch. Existing data is viewable but no new records can be created." |

---

## 15. Priority Order for Fixes

Work through these in order — each group unblocks the next.

**Group 1 — Data correctness (fix these first, everything depends on them)**

1. Fix `normalizeModuleList()` to handle raw JSON strings from LongText columns. This is the root cause of module-related bugs throughout the app.
2. Fix `manageMasterUser` to create a proper `Tenant` row and a default `TenantSubscription` row when creating a new superadmin.
3. Add loan approval handler to `approvals/actions.ts` for `pending_review` loans.

**Group 2 — Security and data integrity**

4. Validate that `Branch.enabledModules ⊆ TenantSubscription.enabledModules` in `reviewBranchRequest` and `createBranch` actions.
5. Validate that `UserBranchModule.enabledModules ⊆ Branch.enabledModules` in `assignAdminModules` (will work correctly after fix 1).
6. Add `branchId` and optional `targetRole` to `SystemNotification` to prevent agents seeing admin-targeted notifications.
7. Scope notification delivery by `branchId` and role.

**Group 3 — UI gaps for correct role model**

8. Add "Branch Requests" link to superadmin sidebar.
9. Add "Branch Requests" link to developer admin sidebar.
10. Add pending loan list to `/approvals` page for admin.
11. Remove `/portal` shortcut from superadmin sidebar footer; replace with Branch Requests.
12. Remove Billing link from admin sidebar for superadmin role.
13. Show branch name as static label in topbar when superadmin has only one branch.
14. Show "pending review" badge on agent-created loans and customers.
15. Add read-only mode for data in removed modules (change layout redirect to allow-through, block only mutations).

**Group 4 — Consistency and polish**

16. Add `deletedAt` soft-delete to `Branch` model.
17. Clear `active_app_type` cookie on login / remove from `getUserAppType`.
18. Show subscription-not-configured prompt after superadmin creation.
19. Add `branchId` filter to `activeAgents` query in dashboard API.
20. Consolidate the two `updateSubscription` actions into one.
21. Add developer notification bell to admin topbar.
