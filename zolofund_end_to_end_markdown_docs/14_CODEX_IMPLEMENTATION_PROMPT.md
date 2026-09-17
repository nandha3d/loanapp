# Codex Implementation Prompt

Use this prompt in Codex or an AI coding agent to implement the remaining work safely.

---

## Prompt

You are working on a Next.js + Prisma + MySQL application named **ZoloFund**.

The project uses:

- Next.js 16 App Router
- React 19
- Prisma 5.22
- MySQL
- NextAuth v5 credentials login
- Server Actions
- Custom CSS

The application is a multi-app loan management system with these app types:

- `microlending`
- `autofinance`
- `chitfunds`

The application uses a shared database with row-level isolation. Every query and mutation must be scoped by:

```text
tenantId + appType
```

For Micro Lending admins, branch isolation must also apply using session `branchId`.

Agents must only see customers and collections for their assigned/shared routes.

---

## Current Critical Issue to Fix First

Fix build issue in:

```text
app/(dashboard)/settings/page.tsx
```

`userRole` is referenced before declaration. Add:

```ts
const userRole = (session?.user as any)?.role;
```

after:

```ts
const session = await auth();
```

Then run:

```bash
npm run build
```

---

## Work Package 1 — RBAC and Middleware

Update `middleware.ts` to follow this access matrix:

- `/portal`, `/admin/*` → developer and superadmin only.
- `/dashboard`, `/loans`, `/penalties`, `/reports`, `/settings` → admin, superadmin, developer only.
- `/collection`, `/notifications` → admin, superadmin, developer, agent.
- `/customers` → admin, superadmin, developer, agent, but agent read-only and scoped.
- `/customers/new` → agent can create, but cannot edit using `?edit=`.
- `/approvals` → admin/superadmin/developer can review; agent can view own requests.

Add server-side checks too. Do not rely only on middleware.

---

## Work Package 2 — Notification App Isolation

Add `appType` to `SystemNotification` in Prisma schema.

Update:

- `app/(dashboard)/notifications/page.tsx`
- `app/(dashboard)/notifications/actions.ts`
- `app/api/notifications/route.ts`
- seed data if needed

Rules:

- Notifications must be filtered by `tenantId + appType`.
- Unread count API must require authentication.
- Mark one and mark all read must update only current app notifications.

Create and run migration:

```bash
npx prisma migrate dev --name add-notification-app-type
npx prisma generate
```

---

## Work Package 3 — Harden API Routes

Update:

- `app/api/customers/route.ts`
- `app/api/loans/route.ts`
- `app/api/notifications/route.ts`

Rules:

- Require auth.
- Apply `tenantId + appType` filters.
- Apply branch filter for Micro Lending admin.
- Apply agent route filter for customer API.
- Block agent from loan API.

---

## Work Package 4 — RouteAgent Shared Route Collection

`RouteAgent` already exists in schema. Make it functional.

Implement:

1. Helper `getAgentRouteIds(agentId)`.
2. Settings UI for assigning multiple agents to a route.
3. Collection page query using RouteAgent route IDs.
4. Collection submit validation to ensure agent is assigned to route.
5. Reports should show actual collecting agent.

Acceptance criteria:

- Agent A and Agent B can both be assigned to Route X.
- Both can see Route X customers.
- Either can collect.
- Collection entry records actual collecting agent ID.

---

## Work Package 5 — Customer Agent Read-Only and Approval Flow

Update customer pages:

- Agent can view only assigned/shared route customers.
- Agent cannot see `Edit` or `New Loan` buttons.
- Agent sees `Request Edit` button.
- Request edit creates ApprovalRequest.
- Admin can approve/reject.
- Approval applies only allowed fields: `name`, `phone`, `address`, `routeId`.
- Approval/rejection is audit logged.

---

## Work Package 6 — Harden Loan Creation

Update `app/(dashboard)/loans/actions.ts`:

- Do not read `appType` from form.
- Use `getUserAppType()` only.
- Block agent role.
- Validate customer belongs to same tenant/app and is active.
- Validate package belongs to same tenant/app.
- Add branch check for Micro Lending admin.
- Add audit log.

---

## Work Package 7 — Complete Audit Logging

Create helper:

```text
lib/audit.ts
```

Add audit logging to all mutations:

- Customer create/update.
- Customer approval/rejection.
- Loan create/close.
- Collection submit.
- Penalty settle/waive.
- Settings save.
- Route create/delete.
- Loan package create/delete.
- User create/update/deactivate.
- Branch create.
- App switch.

---

## Work Package 8 — Seed Users

Update `prisma/seed.ts` to create:

| Username | Password | Role |
|---|---|---|
| `developer` | `dev123` | developer |
| `superadmin` | `super123` | superadmin |
| `admin` | `admin123` | admin |
| `karthik` | `agent123` | agent |

Use bcrypt cost 12 consistently.

---

## Work Package 9 — Testing

After implementation, run:

```bash
npx prisma validate
npm run lint
npm run build
```

Then manually test:

1. Admin login and dashboard.
2. Agent login and collection.
3. Customer create by admin.
4. Customer create by agent and admin approval.
5. Loan create and instalment generation.
6. Collection entry and loan total update.
7. Reports.
8. Agent blocked from restricted pages.
9. App switching and app isolation.
10. Shared route collection.

Add automated Playwright tests if possible.

---

## Important Rules

- Do not introduce a new UI framework unless required.
- Keep current CSS style system.
- Keep TypeScript strictness reasonable.
- Do not trust tenantId, appType, role or agentId from form inputs.
- Prefer `findFirst` with full `tenantId + appType` ownership filter when validating records.
- Return generic not found/access denied messages to avoid data leakage.
- Keep changes incremental and run build after each major work package.
