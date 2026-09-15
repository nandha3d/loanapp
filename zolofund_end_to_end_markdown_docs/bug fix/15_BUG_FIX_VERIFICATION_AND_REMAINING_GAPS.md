# Bug Fix Verification & Remaining Spec Gaps — Implementation Guide

> **Audit date:** Post-fix re-check of the updated `loanapp.zip`  
> **Scope:** Verifies every previously-reported bug, then provides exact implementation instructions for the 3 remaining spec gaps that still need work.

---

## Part 1 — Bug Fix Verification Results

### ✅ BUG-001 — `settings/page.tsx` compile error (userRole before declaration)
**Status: FIXED**  
`userRole` is now declared immediately after `session`. Build passes. Confirmed.

---

### ✅ BUG-002 — `SystemNotification` missing `appType`
**Status: FIXED**  
Schema has `appType String @default("microlending") @map("app_type")`.  
`notifications/page.tsx`, `notifications/actions.ts` (both `markNotificationRead` and `markAllNotificationsRead`), and `api/notifications/route.ts` all correctly filter by `{ tenantId, appType }`. Confirmed.

---

### ✅ BUG-003 — Automated penalty accrual missing
**Status: FIXED**  
`app/api/cron/accrue-penalties/route.ts` exists and is complete:
- Scans overdue instalments grouped by loan
- Reads `default_penalty_per_day`, `penalty_grace_period`, `penalty_max_cap` from tenant settings
- Upserts one `Penalty` record per loan (only grows, never shrinks)
- Marks instalments as `missed`
- Marks loans as `overdue`
- Locks previous day's `DailyCollection` records at midnight
- Protected by `CRON_SECRET` env var

**Action required:** Set up the daily trigger. See Part 2 — Gap-003 below.

---

### ✅ BUG-004 — Shared route collection (RouteAgent not wired)
**Status: FIXED**  
`collection/page.tsx` now calls `getAgentRouteIds(userId)` which resolves both primary (`Route.assignedAgentId`) and shared (`RouteAgent` table) route assignments. Customer filter uses `routeId: { in: agentRouteIds }` instead of `agentId`. Confirmed.

---

### ✅ BUG-005 — `DailyCollection.findFirst()` missing `tenantId` + `appType`
**Status: FIXED**  
`collection/actions.ts` now scopes the lookup as `{ agentId: userId, date: today, tenantId, appType }`. Confirmed.

---

### ✅ BUG-006 — Customer profile — Edit + New Loan buttons shown to agents
**Status: FIXED**  
`CustomerProfileClient.tsx` receives `userRole` prop. Both buttons are wrapped in `{userRole !== 'agent' && (...)}`. `customers/[id]/page.tsx` correctly reads role from session and passes it down. Confirmed.

---

### ✅ BUG-007 — Approval `reviewRequest()` — no tenant/app ownership check, no allow-list, no audit log
**Status: FIXED**  
- `findUnique` now includes `{ tenantId, appType }` so cross-tenant manipulation is blocked.
- `CUSTOMER_EDIT_ALLOW_LIST` set defined at module level; only `name`, `phone`, `address`, `aadharNumber`, `kycStatus`, `photo` can be applied.
- `auditLog.create` called for both approve and reject with `action`, `entityType`, `entityId`.
- `approveCustomerCreation` also verifies customer belongs to tenant and writes an audit log. Confirmed.

---

### ✅ BUG-008 — Settings mutations not audit-logged
**Status: FIXED**  
`saveSystemSettings` and `savePenaltySettings` both call `auditLog.create` after persisting changes. `createUser` in settings also logs. Confirmed.

---

### ✅ BUG-009 — Login events not audit-logged
**Status: FIXED**  
`lib/auth.ts` `authorize()` fires `prisma.auditLog.create({ action: 'login', ... }).catch(() => {})` after successful credential verification. Confirmed.

---

### ✅ BUG-010 — Admin branches page: `developer`-only, but spec requires `superadmin` too
**Status: FIXED**  
`app/admin/branches/page.tsx` now guards with `userRole !== 'developer' && userRole !== 'superadmin'`. Admin layout sidebar shows Branches link to both roles. Confirmed.

---

### ✅ BUG-011 — RouteAgent assign/remove actions — no UI, no server actions
**Status: FIXED**  
`settings/actions.ts` exports `assignAgentToRoute` and `removeAgentFromRoute`, both with tenant ownership checks. `SettingsClient.tsx` has a RouteAgent modal triggered per route row. Confirmed.

---

### ✅ BUG-012 — Seed file missing superadmin and developer users
**Status: FIXED** (was already present — earlier audit was incorrect)  
`prisma/seed.ts` creates both `superadmin` (super123) and `developer` (dev123). Login credentials printed in seed output. Confirmed.

---

## Part 2 — Remaining Gaps (Still Need Work)

The following 3 items are **not yet done** in this build. Each section below is a self-contained implementation spec.

---

## GAP-001 — `middleware.ts` is missing entirely

### Problem
There is no `middleware.ts` at the project root. Without it, all route-level access control relies on per-page redirects, which means:
- A direct URL hit to `/settings` by an agent will render the page server-side before the redirect fires (flash / timing risk).
- There is no centralized enforcement of the access matrix.

### Target Access Matrix

| Route pattern | agent | admin | superadmin | developer |
|---|---|---|---|---|
| `/collection` | ✅ | ✅ | ✅ | ✅ |
| `/customers` | ✅ (read-only) | ✅ | ✅ | ✅ |
| `/customers/new` (no edit param) | ✅ | ✅ | ✅ | ✅ |
| `/customers/new?edit=*` | ❌ | ✅ | ✅ | ✅ |
| `/approvals` | ✅ (own only) | ✅ | ✅ | ✅ |
| `/loans` | ❌ | ✅ | ✅ | ✅ |
| `/loans/new` | ❌ | ✅ | ✅ | ✅ |
| `/penalties` | ❌ | ✅ | ✅ | ✅ |
| `/reports` | ❌ | ✅ | ✅ | ✅ |
| `/settings` | ❌ | ✅ | ✅ | ✅ |
| `/dashboard` | ❌ | ✅ | ✅ | ✅ |
| `/admin/*` | ❌ | ❌ | ✅ | ✅ |
| `/portal` | ❌ | ❌ | ✅ | ✅ |

### Implementation

Create file: **`middleware.ts`** (project root, next to `package.json`)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const AGENT_ALLOWED = [
  '/collection',
  '/customers',
  '/approvals',
  '/notifications',
  '/api/',
];

const ADMIN_AND_ABOVE = [
  '/loans',
  '/penalties',
  '/reports',
  '/settings',
  '/dashboard',
];

const SUPERADMIN_ONLY = [
  '/portal',
  '/admin',
];

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname, search } = req.nextUrl;

  // Unauthenticated — allow login page only
  if (!token) {
    if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const role = token.role as string;

  // Agents: block admin-and-above routes
  if (role === 'agent') {
    const blockedAdmin = ADMIN_AND_ABOVE.some((p) => pathname.startsWith(p));
    if (blockedAdmin) {
      return NextResponse.redirect(new URL('/collection', req.url));
    }

    // Block edit access: /customers/new?edit=xxx
    if (pathname.startsWith('/customers/new')) {
      const params = new URLSearchParams(search);
      if (params.has('edit')) {
        return NextResponse.redirect(new URL('/customers', req.url));
      }
    }

    // Block superadmin/portal routes
    const blockedSuper = SUPERADMIN_ONLY.some((p) => pathname.startsWith(p));
    if (blockedSuper) {
      return NextResponse.redirect(new URL('/collection', req.url));
    }
  }

  // Admin: block portal and admin panel
  if (role === 'admin') {
    const blockedSuper = SUPERADMIN_ONLY.some((p) => pathname.startsWith(p));
    if (blockedSuper) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // Superadmin / developer: full access
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/).*)',
  ],
};
```

### Also update `lib/auth.ts` JWT callback

Make sure `role` is included in the JWT token so middleware can read it:

```ts
// In your NextAuth config, inside callbacks:
jwt({ token, user }) {
  if (user) {
    token.role = (user as any).role;
    token.id = (user as any).id;
    token.appType = (user as any).appType;
  }
  return token;
},
session({ session, token }) {
  (session.user as any).role = token.role;
  (session.user as any).id = token.id;
  (session.user as any).appType = token.appType;
  return session;
},
```

### Acceptance Criteria
- [ ] Agent hitting `/settings` directly is redirected to `/collection`
- [ ] Agent hitting `/customers/new?edit=xyz` is redirected to `/customers`
- [ ] Admin hitting `/portal` is redirected to `/dashboard`
- [ ] Unauthenticated user hitting any route is redirected to `/login`
- [ ] Superadmin and developer have full access to all routes

---

## GAP-002 — Admin panel actions missing audit logs

### Problem
`app/admin/actions.ts` has `manageMasterUser`, `createBranch`, and `toggleUserStatus` — none of them write to `AuditLog`. This means user creation, role changes, branch creation, and activate/deactivate are invisible in the audit trail.

### Implementation

Update **`app/admin/actions.ts`** — add audit logging to all three actions:

#### `manageMasterUser` — add after the create/update call

```ts
// After prisma.user.create or prisma.user.update, add:
const actorId = session?.user?.id;
await prisma.auditLog.create({
  data: {
    tenantId,
    userId: actorId,
    action: id ? 'update' : 'create',
    entityType: 'user',
    entityId: id ?? newUserId,   // use the returned user id on create
    newValue: JSON.stringify({ name, username, role, appType, status }),
  },
}).catch(() => {});
```

For the **create** path, capture the returned user:

```ts
const savedUser = await prisma.user.create({ data: { ... } });
// then log savedUser.id
```

For the **update** path:

```ts
await prisma.user.update({ where: { id }, data: updateData });
// then log id
```

#### `createBranch` — add after `prisma.branch.create`

```ts
const branch = await prisma.branch.create({
  data: { tenantId, name, code, phone },
});

const actorId = (session?.user as any)?.id;
await prisma.auditLog.create({
  data: {
    tenantId,
    userId: actorId,
    action: 'create',
    entityType: 'branch',
    entityId: branch.id,
    newValue: JSON.stringify({ name, code }),
  },
}).catch(() => {});
```

#### `toggleUserStatus` — add after `prisma.user.update`

```ts
export async function toggleUserStatus(userId: string, newStatus: string) {
  const session = await auth();
  const actorId = (session?.user as any)?.id;
  const tenantId = await getDefaultTenantId();
  const role = (session?.user as any)?.role;
  if (role !== 'superadmin' && role !== 'developer') return { success: false };

  await prisma.user.update({
    where: { id: userId },
    data: { status: newStatus },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: actorId,
      action: 'update',
      entityType: 'user',
      entityId: userId,
      newValue: JSON.stringify({ status: newStatus }),
    },
  }).catch(() => {});

  revalidatePath('/admin/users');
  return { success: true };
}
```

### Acceptance Criteria
- [ ] Creating a new master user writes an AuditLog with `action: 'create'`, `entityType: 'user'`
- [ ] Editing a master user writes an AuditLog with `action: 'update'`
- [ ] Creating a branch writes an AuditLog with `action: 'create'`, `entityType: 'branch'`
- [ ] Toggling user active/inactive writes an AuditLog with `action: 'update'`

---

## GAP-003 — Cron trigger for penalty accrual not configured

### Problem
The cron handler `app/api/cron/accrue-penalties/route.ts` is complete and correct, but it is never called automatically. The midnight ledger-lock and penalty accrual will not run unless this endpoint is triggered daily.

### Option A — Vercel Cron (recommended if deploying to Vercel)

Add to **`vercel.json`** (create at project root if it doesn't exist):

```json
{
  "crons": [
    {
      "path": "/api/cron/accrue-penalties",
      "schedule": "0 0 * * *"
    }
  ]
}
```

Add `CRON_SECRET` to Vercel environment variables. Vercel automatically sends the `Authorization: Bearer <CRON_SECRET>` header.

> **Note:** Vercel Cron uses UTC. For IST midnight (18:30 UTC), use `"schedule": "30 18 * * *"`.

### Option B — GitHub Actions (free, any host)

Create **`.github/workflows/daily-cron.yml`**:

```yaml
name: Daily Penalty Accrual

on:
  schedule:
    - cron: '30 18 * * *'   # 18:30 UTC = midnight IST
  workflow_dispatch:          # allow manual trigger from GitHub UI

jobs:
  accrue:
    runs-on: ubuntu-latest
    steps:
      - name: Call penalty accrual endpoint
        run: |
          curl -f -X GET \
            "${{ secrets.APP_URL }}/api/cron/accrue-penalties" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

Set `APP_URL` and `CRON_SECRET` in GitHub → Settings → Secrets and variables → Actions.

### Option C — OS cron (VPS / self-hosted)

```bash
# Edit crontab
crontab -e

# Add this line (runs at midnight IST = 18:30 UTC)
30 18 * * * curl -s -X GET https://yourdomain.com/api/cron/accrue-penalties -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/zolofund-cron.log 2>&1
```

### Verify `CRON_SECRET` is set in `.env`

```bash
# .env.local
CRON_SECRET=your-long-random-secret-here
```

Generate a secure secret:
```bash
openssl rand -hex 32
```

### Manual test (development)

```bash
# Without secret protection (dev only — remove CRON_SECRET from .env temporarily)
curl http://localhost:3000/api/cron/accrue-penalties

# With secret
curl -H "Authorization: Bearer your-secret" http://localhost:3000/api/cron/accrue-penalties
```

Expected response:
```json
{
  "ok": true,
  "loansProcessed": 3,
  "penaltiesCreated": 2,
  "penaltiesUpdated": 1,
  "dailyCollectionsLocked": 5,
  "runAt": "2025-01-15T18:30:00.000Z"
}
```

### Acceptance Criteria
- [ ] Cron runs once per day at midnight IST
- [ ] Missed instalments get `status: 'missed'`
- [ ] Loans with missed payments get `status: 'overdue'`
- [ ] Penalty records created/updated with correct `grossPenalty` (respecting grace period and cap)
- [ ] Previous day's open `DailyCollection` records get `status: 'locked'`
- [ ] Response logged for observability

---

## Part 3 — Final Checklist (Pre-UAT)

| # | Item | Status |
|---|---|---|
| 1 | Settings page compile bug | ✅ Fixed |
| 2 | Middleware (route-level access control) | ❌ **Not done — GAP-001** |
| 3 | SystemNotification appType scoping | ✅ Fixed |
| 4 | Penalty accrual cron handler | ✅ Exists — needs trigger |
| 5 | Cron trigger configured | ❌ **Not done — GAP-003** |
| 6 | Shared route (RouteAgent) in collection | ✅ Fixed |
| 7 | DailyCollection tenantId+appType scope | ✅ Fixed |
| 8 | Customer profile agent read-only UI | ✅ Fixed |
| 9 | Approval allow-list + tenant check | ✅ Fixed |
| 10 | Approval audit logging | ✅ Fixed |
| 11 | Settings mutations audit logged | ✅ Fixed |
| 12 | Login events audit logged | ✅ Fixed |
| 13 | Admin panel audit logging | ❌ **Not done — GAP-002** |
| 14 | Admin branches superadmin access | ✅ Fixed |
| 15 | RouteAgent assign/remove UI + actions | ✅ Fixed |
| 16 | Seed file superadmin/developer users | ✅ Already present |
