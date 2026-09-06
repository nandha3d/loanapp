# Development Backlog and Implementation Tickets

## 1. Priority Legend

| Priority | Meaning |
|---|---|
| P0 | Must fix before local build / secure testing |
| P1 | Must fix before MVP/UAT |
| P2 | Needed before production release |
| P3 | Future phase / enhancement |

---

## Phase 0 — Stabilize Build and Critical Security

### LT-P0-001 — Fix Settings Page Compile Bug

**Priority:** P0  
**File:** `app/(dashboard)/settings/page.tsx`

**Problem:** `userRole` is used before it is declared.

**Implementation:**

```ts
const session = await auth();
const userRole = (session?.user as any)?.role;
```

**Acceptance Criteria:**

- `npm run build` does not fail because of `userRole`.
- Agent cannot access settings.
- Admin/superadmin/developer can access settings based on route rules.

---

### LT-P0-002 — Align Middleware With Target Access Matrix

**Priority:** P0  
**File:** `middleware.ts`

**Problem:** Current middleware blocks agents from `/customers` and `/approvals`, but target behavior allows read-only customer access and own approval request view.

**Implementation:**

- Move `/customers` and `/approvals` out of admin-only group.
- Add special check for `/customers/new?edit=` for agents.
- Keep `/loans`, `/penalties`, `/reports`, `/settings`, `/dashboard` admin-only.

**Acceptance Criteria:**

- Agent can access `/collection`.
- Agent can access `/customers` with scoped data.
- Agent can access `/approvals` with own requests.
- Agent cannot access `/loans`, `/reports`, `/penalties`, `/settings`.

---

### LT-P0-003 — Add AppType to Notifications

**Priority:** P0  
**Files:**

```text
prisma/schema.prisma
app/(dashboard)/notifications/page.tsx
app/(dashboard)/notifications/actions.ts
app/api/notifications/route.ts
prisma/seed.ts
```

**Problem:** Notifications cannot be scoped by app because `SystemNotification` lacks `appType`.

**Implementation:**

- Add `appType` field to `SystemNotification`.
- Update queries and mutations to include appType.
- Require auth in notification count API.

**Acceptance Criteria:**

- Micro Lending notifications do not appear in Auto Finance/Chit Funds.
- Mark all read updates only current app notifications.
- API unread count returns scoped count only.

---

### LT-P0-004 — Harden API Routes

**Priority:** P0  
**Files:**

```text
app/api/customers/route.ts
app/api/loans/route.ts
app/api/notifications/route.ts
```

**Problem:** API routes are not fully app/role/branch scoped.

**Implementation:**

- Add session role validation.
- Add `appType` filter.
- Add branch filter for ML admin.
- Add route filter for agent customer API.
- Restrict loan API to admin/superadmin/developer.

**Acceptance Criteria:**

- Agent cannot fetch all loans via API.
- Agent customer API returns only assigned/shared route customers.
- Wrong app data is not returned.

---

### LT-P0-005 — Stop Trusting AppType from Forms

**Priority:** P0  
**File:** `app/(dashboard)/loans/actions.ts`

**Problem:** `createLoan()` accepts `appType` from form data.

**Implementation:**

- Use `const appType = await getUserAppType();` only.
- Validate selected customer and package belong to same tenant/app.

**Acceptance Criteria:**

- Tampering hidden form field cannot create cross-app loan.
- Customer/package mismatch returns error.

---

## Phase 1 — Complete Micro Lending MVP

### LT-P1-001 — Complete RouteAgent Shared Route Assignment

**Priority:** P1  
**Files:**

```text
app/(dashboard)/settings/SettingsClient.tsx
app/(dashboard)/settings/actions.ts
app/(dashboard)/collection/page.tsx
app/(dashboard)/reports/page.tsx
prisma/schema.prisma
```

**Problem:** `RouteAgent` exists but is not used for shared route collection.

**Implementation:**

- Add multi-select route-agent assignment UI.
- Create/update `RouteAgent` rows.
- Collection page should fetch customers by assigned route IDs.
- Reports should use actual collection agent and route-agent mapping.

**Acceptance Criteria:**

- Two agents assigned to same route can both see that route's customers.
- Collection entry records actual collecting agent.
- Removing an agent from a route removes access.

---

### LT-P1-002 — Agent Customer Read-Only Experience

**Priority:** P1  
**Files:**

```text
app/(dashboard)/customers/page.tsx
app/(dashboard)/customers/[id]/page.tsx
app/(dashboard)/customers/[id]/CustomerProfileClient.tsx
```

**Implementation:**

- Add role-aware query scoping.
- Hide edit and new loan buttons for agents.
- Add Request Edit button for agents.

**Acceptance Criteria:**

- Agent sees only own/shared route customers.
- Agent cannot see edit/new-loan options.
- Agent can create approval request.

---

### LT-P1-003 — Complete Approval Request UI and Safety

**Priority:** P1

**Implementation:**

- Add agent request edit form.
- Add field-level allow-list for requested changes.
- Validate target entity ownership before applying changes.
- Add audit logs for approve/reject.

**Acceptance Criteria:**

- Agent can submit request with reason.
- Admin can approve/reject.
- Rejected changes do not update customer.
- Approved changes update only allowed fields.

---

### LT-P1-004 — Apply Branch Isolation for Micro Lending Admin

**Priority:** P1

**Implementation:**

- Create helper to build scoped where clauses.
- Apply branch filter to dashboard, customers, loans, collection, reports, penalties, settings where applicable.

**Acceptance Criteria:**

- Branch A admin cannot view Branch B customers, loans, routes or reports.
- Superadmin/developer can view all branches in selected app.

---

### LT-P1-005 — Complete Audit Logging

**Priority:** P1

**Implementation:**

Add audit logs to:

- Customer create/update.
- Customer approval/rejection.
- User create/update/deactivate.
- Branch create.
- Route create/delete.
- Loan package create/delete.
- Settings changes.
- App switch.
- Login.

**Acceptance Criteria:**

- Audit logs are created for all mutation flows.
- Audit log includes userId, tenantId, action, entityType and entityId.

---

### LT-P1-006 — Replace Mock File Uploads

**Priority:** P1/P2

**Current issue:** Customer files are stored as filenames only.

**Implementation options:**

- Local storage for MVP.
- S3-compatible object storage for production.
- Store path, MIME type, file size and uploadedBy.

**Acceptance Criteria:**

- Uploaded file is physically saved.
- Invalid file type is rejected.
- File path is not user-controlled.
- File size is limited.

---

## Phase 2 — Production Readiness

### LT-P2-001 — Add Seed Users for All Roles

**Priority:** P2

Seed should include:

| Username | Role | Purpose |
|---|---|---|
| `developer` | developer | Technical/admin setup |
| `superadmin` | superadmin | Cross-app business admin |
| `admin` | admin | Micro Lending admin |
| `karthik` | agent | Demo field agent |

**Acceptance Criteria:**

- All major role flows can be tested after seed.
- Developer/superadmin can access portal.

---

### LT-P2-002 — Add Database Migration Discipline

**Priority:** P2

**Implementation:**

- Use Prisma migrations instead of only `db push`.
- Create migration for notification appType, Vehicle and Chit models when implemented.
- Add migration rollback notes.

---

### LT-P2-003 — Add Automated Test Framework

**Priority:** P2

Recommended tools:

- Unit tests: Vitest.
- E2E tests: Playwright.
- API/server action tests: Vitest + test database or integration scripts.

**Acceptance Criteria:**

- Test command runs in CI.
- E2E covers admin and agent flows.
- RBAC negative tests are automated.

---

## Phase 3 — Auto Finance

### LT-P3-001 — Vehicle Module

**Priority:** P3

Build:

- Vehicle model.
- Vehicle CRUD.
- Link vehicle to customer and loan.
- RC and insurance document upload.
- Registration number search.

---

### LT-P3-002 — Auto Finance EMI Rules

**Priority:** P3

Build:

- EMI-style package templates.
- Monthly collection schedule.
- 90+ day overdue repo flag.
- AF-specific dashboard cards.

---

## Phase 4 — Chit Funds

### LT-P4-001 — Chit Group Lifecycle

Build:

- ChitGroup CRUD.
- Member onboarding.
- Ticket number allocation.
- Monthly subscription ledger.
- Auction entry and winner selection.
- Dividend calculation.

---

## 2. Development Sequencing Recommendation

Do not start Auto Finance/Chit Funds until these are complete:

1. Build passes.
2. RBAC access matrix passes.
3. RouteAgent shared route logic passes.
4. App/tenant/branch isolation tests pass.
5. Micro Lending happy path works end-to-end.
