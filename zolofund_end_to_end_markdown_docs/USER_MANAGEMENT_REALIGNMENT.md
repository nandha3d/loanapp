# USER_MANAGEMENT_REALIGNMENT.md
# Implementation Guide: Role & Branch Model Redesign

> Covers every file that must change, the exact schema migrations needed,
> and the new business rules to enforce. Work through the phases in order —
> each phase leaves the app in a deployable state.

---

## Overview of Changes

| What changes | Current state | Target state |
|---|---|---|
| `developer` role | Exists in middleware check only | Real DB role with platform-only access |
| Branch | Name/code/address only | Gains `enabledModules` JSON + `superadminId` FK |
| Superadmin | Single `appType` cookie switcher | Multi-branch switcher, no appType concept |
| Admin | Single branch, one `appType` | Single branch, module subset assigned by superadmin |
| Agent | Collection only | Can also create customers and loans |
| `BranchRequest` | Does not exist | New model: superadmin requests branch from developer |
| `UserBranchModule` | Does not exist | New model: per-admin module access within a branch |
| Active branch context | Cookie `active_app_type` | Cookie `active_branch_id` (replaces app type cookie) |
| Borrower | Exists | Unchanged — read-only loan view |

---

## Phase 1 — Prisma Schema Changes

### 1.1 Modify `Branch` model

Add `enabledModules` (JSON list of module keys granted by developer) and a soft
reference to the superadmin who owns it.

```prisma
model Branch {
  id             String    @id @default(cuid())
  tenantId       String    @map("tenant_id")
  superadminId   String?   @map("superadmin_id")   // ← NEW: owning superadmin
  name           String
  code           String?
  address        String?   @db.Text
  phone          String?
  status         String    @default("active")
  enabledModules Json      @default("[]") @map("enabled_modules")  // ← NEW: ["microlending","vehicles","chitfunds"]
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  tenant         Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  superadmin     User?     @relation("SuperadminBranches", fields: [superadminId], references: [id])

  // existing relations stay unchanged …
  chitGroups     ChitGroup[]
  customers      Customer[]
  collections    DailyCollection[]
  loans          Loan[]
  routes         Route[]
  users          User[]
  branchRequests BranchRequest[]
  userModules    UserBranchModule[]

  @@unique([tenantId, code])
  @@index([superadminId], map: "branches_superadmin_id_fkey")
  @@map("branches")
}
```

### 1.2 Add `BranchRequest` model

Superadmin requests a new branch or new module set from the developer.

```prisma
model BranchRequest {
  id               String    @id @default(cuid())
  tenantId         String    @map("tenant_id")
  requestedById    String    @map("requested_by_id")   // superadmin user id
  branchId         String?   @map("branch_id")         // null = new branch request; set = module change on existing branch
  branchName       String?   @map("branch_name")       // proposed name for new branch
  requestedModules Json      @map("requested_modules") // ["microlending","vehicles"]
  reason           String?   @db.Text
  status           String    @default("pending")       // pending | approved | rejected
  reviewedById     String?   @map("reviewed_by_id")    // developer user id
  reviewNote       String?   @map("review_note") @db.Text
  reviewedAt       DateTime? @map("reviewed_at")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  tenant           Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  requestedBy      User      @relation("BranchRequestsMade", fields: [requestedById], references: [id])
  reviewedBy       User?     @relation("BranchRequestsReviewed", fields: [reviewedById], references: [id])
  branch           Branch?   @relation(fields: [branchId], references: [id])

  @@index([tenantId])
  @@index([requestedById])
  @@map("branch_requests")
}
```

### 1.3 Add `UserBranchModule` model

Superadmin assigns a subset of branch modules to a specific admin user.

```prisma
model UserBranchModule {
  id             String   @id @default(cuid())
  userId         String   @map("user_id")
  branchId       String   @map("branch_id")
  enabledModules Json     @map("enabled_modules")  // subset of branch.enabledModules
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  branch         Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@unique([userId, branchId])
  @@index([branchId])
  @@map("user_branch_modules")
}
```

### 1.4 Update `User` model

Add back-relations for the new models and remove the single `appType` field
from non-agent/admin users (appType becomes branch-derived for superadmin).

```prisma
model User {
  // … existing fields unchanged …

  // NEW back-relations
  superadminBranches        Branch[]           @relation("SuperadminBranches")
  branchRequestsMade        BranchRequest[]    @relation("BranchRequestsMade")
  branchRequestsReviewed    BranchRequest[]    @relation("BranchRequestsReviewed")
  userBranchModules         UserBranchModule[]

  // appType field stays for agent/admin rows (they are scoped to one branch+module)
  // For superadmin rows appType is ignored; derive from active branch's enabledModules
}
```

### 1.5 Add `Tenant` back-relations

```prisma
model Tenant {
  // … existing fields …
  branchRequests BranchRequest[]
}
```

### 1.6 Run the migration

```bash
npm run db:generate
npm run db:migrate   # dev
# production:
npm run db:deploy
```

#### Backfill SQL (run once after migration)

```sql
-- Give every existing branch an empty module array if null
UPDATE branches SET enabled_modules = '[]' WHERE enabled_modules IS NULL;

-- Assign the first superadmin of each tenant as branch owner
UPDATE branches b
JOIN users u ON u.tenant_id = b.tenant_id AND u.role = 'superadmin'
SET b.superadmin_id = u.id
WHERE b.superadmin_id IS NULL;
```

---

## Phase 2 — Type Definitions

### `types/index.ts` — extend session types

```typescript
// Add activeBranchId to JWT and Session

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: string;
    tenantId?: string;
    branchId?: string | null;        // for admin/agent: their fixed branch
    activeBranchId?: string | null;  // NEW: for superadmin active branch (from cookie)
    phone?: string;
    username?: string;
    appType?: string;                // kept for agent/admin rows
  }
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      tenantId: string;
      branchId: string | null;
      activeBranchId: string | null; // NEW
      phone: string;
      username: string;
      appType: string;
    } & DefaultSession['user'];
  }
}
```

### `types/modules.ts` — new file

```typescript
export const ALL_MODULES = [
  'microlending',
  'autofinance',
  'chitfunds',
] as const;

export type ModuleKey = (typeof ALL_MODULES)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  microlending: 'Micro Lending',
  autofinance:  'Auto Finance',
  chitfunds:    'Chit Funds',
};

// Maps module keys to the route prefixes they unlock in the sidebar
export const MODULE_ROUTES: Record<ModuleKey, string[]> = {
  microlending: ['/loans', '/customers', '/collection', '/penalties', '/reports'],
  autofinance:  ['/vehicles'],
  chitfunds:    ['/chits'],
};
```

---

## Phase 3 — New `lib/branch.ts` Helper

Create this file. It is the single source of truth for branch-context resolution,
replacing the `active_app_type` cookie logic scattered across `lib/tenant.ts`.

```typescript
// lib/branch.ts
import { cache } from 'react';
import { cookies } from 'next/headers';
import { auth } from './auth';
import prisma from './db';
import type { ModuleKey } from '@/types/modules';

type SessionUser = {
  role?: string | null;
  branchId?: string | null;
  tenantId?: string | null;
};

// ─── Active branch resolution ────────────────────────────────────────────────
//
// Rules:
//   developer  → no branch context (platform-level only)
//   superadmin → reads cookie `active_branch_id`; must be a branch they own
//   admin      → their fixed User.branchId (set at creation, never changes)
//   agent      → their fixed User.branchId

export const getActiveBranchId = cache(async (): Promise<string | null> => {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  const role = user?.role;

  if (!role) return null;
  if (role === 'developer') return null;

  if (role === 'superadmin') {
    const cookieStore = await cookies();
    const cookieBranchId = cookieStore.get('active_branch_id')?.value;
    if (!cookieBranchId) return null;

    // Verify this branch belongs to the superadmin's tenant
    const branch = await prisma.branch.findFirst({
      where: {
        id: cookieBranchId,
        tenantId: user?.tenantId ?? '',
        status: 'active',
      },
      select: { id: true },
    });
    return branch?.id ?? null;
  }

  // admin / agent / borrower — use their fixed branchId
  return user?.branchId ?? null;
});

// ─── Module access ────────────────────────────────────────────────────────────

export async function getBranchEnabledModules(branchId: string): Promise<ModuleKey[]> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { enabledModules: true },
  });
  if (!branch) return [];
  return (branch.enabledModules as ModuleKey[]) ?? [];
}

// For admin users: returns their personal module subset for the branch.
// If no UserBranchModule row exists, falls back to the full branch module set.
export async function getUserModulesForBranch(
  userId: string,
  branchId: string,
): Promise<ModuleKey[]> {
  const ubm = await prisma.userBranchModule.findUnique({
    where: { userId_branchId: { userId, branchId } },
    select: { enabledModules: true },
  });
  if (ubm) return (ubm.enabledModules as ModuleKey[]) ?? [];
  return getBranchEnabledModules(branchId);
}

// Convenience: get the active branch's module set for the current session user
export const getActiveModules = cache(async (): Promise<ModuleKey[]> => {
  const session = await auth();
  const user = session?.user as (SessionUser & { id?: string }) | undefined;
  const role = user?.role;

  if (!role || role === 'developer') return [];

  const branchId = await getActiveBranchId();
  if (!branchId) return [];

  if (role === 'admin') {
    return getUserModulesForBranch(user?.id ?? '', branchId);
  }

  // superadmin sees all branch modules; agent sees all branch modules
  return getBranchEnabledModules(branchId);
});

// ─── Branch list for superadmin ──────────────────────────────────────────────

export async function getSuperadminBranches(tenantId: string, superadminId: string) {
  return prisma.branch.findMany({
    where: {
      tenantId,
      superadminId,
      status: 'active',
    },
    select: {
      id: true,
      name: true,
      code: true,
      enabledModules: true,
    },
    orderBy: { name: 'asc' },
  });
}
```

---

## Phase 4 — Update `lib/tenant.ts`

Remove `getUserAppType()` for superadmin (it used `active_app_type` cookie).
Replace with branch-derived appType.

```typescript
// lib/tenant.ts — REPLACE getUserAppType with this version

export async function getUserAppType(): Promise<string> {
  const session = await auth();
  const user = session?.user as SessionUserContext | undefined;
  const role = user?.role;

  // developer has no app type context
  if (role === 'developer') return 'microlending';

  // superadmin: derive appType from the active branch's first enabled module
  // (appType is only needed for legacy queries that haven't been updated yet)
  if (role === 'superadmin') {
    const { getActiveBranchId, getBranchEnabledModules } = await import('./branch');
    const branchId = await getActiveBranchId();
    if (branchId) {
      const modules = await getBranchEnabledModules(branchId);
      if (modules.length > 0) return modules[0]; // primary module of branch
    }
  }

  return user?.appType || 'microlending';
}
```

Also update `getCurrentTenantId` to skip subscription check for `/branch-requests` path:

```typescript
// Inside getCurrentTenantId cache function, update the path exclusion:
if (
  !pathname.startsWith('/subscription') &&
  !pathname.startsWith('/portal') &&
  !pathname.startsWith('/admin') &&
  !pathname.startsWith('/branch-requests')   // ← ADD THIS LINE
) {
  await assertTenantSubscriptionAccess(tenantId);
}
```

---

## Phase 5 — Update `lib/serverActionAuth.ts`

Extend `ActionContext` to carry branch and module context.

```typescript
// lib/serverActionAuth.ts — full replacement

import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';
import { getActiveBranchId, getActiveModules } from '@/lib/branch';
import type { ModuleKey } from '@/types/modules';

export type ActionContext = {
  userId: string;
  tenantId: string;
  role: string;
  branchId: string | null;    // active branch for this request
  modules: ModuleKey[];       // modules the user can act on
};

export type ActionResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function withActionAuth<T>(
  allowedRoles: string[] = [],
  action: (context: ActionContext) => Promise<ActionResponse<T>>
): Promise<ActionResponse<T>> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const role = (session?.user as any)?.role;

    if (!userId || !role) {
      return { success: false, error: 'Unauthorized: No active session' };
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const tenantId = await getDefaultTenantId();
    if (!tenantId) {
      return { success: false, error: 'Invalid tenant context' };
    }

    const branchId = await getActiveBranchId();
    const modules = await getActiveModules();

    return await action({ userId, tenantId, role, branchId, modules });
  } catch (error: any) {
    console.error('[Server Action Error]', error);
    return { success: false, error: error.message || 'An unexpected server error occurred' };
  }
}
```

---

## Phase 6 — Update `middleware.ts`

### 6.1 Replace role-based route guards

The current middleware blocks agents from `/loans`. That must change — agents
can now create loans. Adjust `AGENT_BLOCKED` and add module-aware redirects.

```typescript
// middleware.ts — updated constants and role-based section

// Agents can no longer be blocked from loans/customers — they can create both.
// They ARE still blocked from management/reporting/settings views.
const AGENT_BLOCKED = [
  '/dashboard',     // KPI dashboard (admin+ only)
  '/penalties',
  '/reports',
  '/settings',
  '/approvals',
  '/subscription',
];

const SUPERADMIN_ONLY = ['/portal', '/admin'];

// Developer-only paths (no tenant business data)
const DEVELOPER_ONLY = ['/admin'];
```

Update the role section inside `middleware()`:

```typescript
// 3. Role-based Redirection

const role = typeof token.role === 'string' ? token.role : 'agent';

// Developer: can access /admin and /portal only; redirect all other paths
if (role === 'developer') {
  if (!DEVELOPER_ONLY.some(p => pathname.startsWith(p)) &&
      !pathname.startsWith('/portal') &&
      !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }
}

// Superadmin/admin/agent blocked from developer-only paths
if (role !== 'developer' && DEVELOPER_ONLY.some(p => pathname.startsWith(p))) {
  return NextResponse.redirect(new URL('/dashboard', request.url));
}

// Superadmin: /portal allowed; /admin blocked
if (role === 'superadmin' && pathname.startsWith('/admin')) {
  return NextResponse.redirect(new URL('/dashboard', request.url));
}

// Admin: block superadmin-only paths
if (role === 'admin' && pathname.startsWith('/portal')) {
  return NextResponse.redirect(new URL('/dashboard', request.url));
}

// Agent: block reporting/management paths
if (role === 'agent') {
  if (AGENT_BLOCKED.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.redirect(new URL('/collection', request.url));
  }
  if (SUPERADMIN_ONLY.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.redirect(new URL('/collection', request.url));
  }
}
```

### 6.2 Inject active branch header

After the role checks, inject `active_branch_id` into headers so server
components can read it without hitting cookies again.

```typescript
// At the end of middleware(), before returning nextWithTenantHeaders:
const activeBranchId = request.cookies.get('active_branch_id')?.value;
if (activeBranchId) {
  // handled inside nextWithTenantHeaders — extend that function:
}
```

Update `nextWithTenantHeaders` to also forward `active_branch_id`:

```typescript
function nextWithTenantHeaders(
  request: NextRequest,
  tenantSlug: string | null,
  options: { forceDocument?: boolean } = {},
) {
  const requestHeaders = new Headers(request.headers);
  // … existing header logic …

  // Forward active branch cookie as a header for server components
  const activeBranch = request.cookies.get('active_branch_id')?.value;
  if (activeBranch) {
    requestHeaders.set('x-zolofund-active-branch', activeBranch);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}
```

---

## Phase 7 — Branch Switcher (Server Action + UI)

### 7.1 Server action `app/(dashboard)/actions/branch.ts`

```typescript
'use server';

import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

export async function switchActiveBranch(branchId: string) {
  const session = await auth();
  const user = session?.user as any;

  if (!user || user.role !== 'superadmin') {
    return { success: false, error: 'Only superadmins can switch branches' };
  }

  // Verify the branch belongs to this superadmin's tenant
  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      tenantId: user.tenantId,
      superadminId: user.id,
      status: 'active',
    },
    select: { id: true, name: true },
  });

  if (!branch) {
    return { success: false, error: 'Branch not found or access denied' };
  }

  const cookieStore = await cookies();
  cookieStore.set('active_branch_id', branchId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return { success: true, data: { branchId, branchName: branch.name } };
}
```

### 7.2 Branch switcher component `components/layout/BranchSwitcher.tsx`

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { switchActiveBranch } from '@/app/(dashboard)/actions/branch';

type Branch = {
  id: string;
  name: string;
  enabledModules: string[];
};

type Props = {
  branches: Branch[];
  activeBranchId: string | null;
};

export default function BranchSwitcher({ branches, activeBranchId }: Props) {
  const router = useRouter();

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const result = await switchActiveBranch(e.target.value);
    if (result.success) {
      router.refresh(); // full page refresh reloads all branch-scoped data
    }
  }

  if (branches.length <= 1) return null; // no switcher needed for single branch

  return (
    <select
      value={activeBranchId ?? ''}
      onChange={handleChange}
      className="branch-switcher"
      aria-label="Switch active branch"
    >
      {branches.map(b => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
```

### 7.3 Mount in `app/(dashboard)/layout.tsx`

```tsx
// In the dashboard layout server component, add:
import { getSuperadminBranches, getActiveBranchId } from '@/lib/branch';

// Inside the layout function, after getting the session:
let branches: Branch[] = [];
let activeBranchId: string | null = null;

if (role === 'superadmin') {
  branches = await getSuperadminBranches(tenantId, userId);
  activeBranchId = await getActiveBranchId();

  // Auto-set cookie to first branch if not set
  if (!activeBranchId && branches.length > 0) {
    // Can't set cookies in Server Component — pass a flag to client
    activeBranchId = branches[0].id;
  }
}

// Pass to Topbar or Sidebar:
<Topbar>
  <BranchSwitcher branches={branches} activeBranchId={activeBranchId} />
</Topbar>
```
### 7.4 Self-serve tenant signup, Branch request notifications, Agent loan creation approval flow, Module removal handling 
1. tenant signup via always manual via the developer portal
2. Branch request notifications via n-app notifications, with a new "Branch Request" type. When a superadmin submits a branch request, the developers get notified in their dashboard and can review/approve it. This keeps the tenant onboarding process self-serve while giving developers control over branch creation.
3. Agent loan creation approval flow: when an agent creates a loan, it is marked as "pending_review". A notification is sent to the admins of that branch, who can then review and approve/reject the loan. This allows agents to create loans while ensuring that admins maintain oversight and control over loan creation.
4. Module removal handling — if a developer removes a module from a branch, any existing loans/customers in that module for that branch are not deleted but become read-only. Admins and agents can view them but cannot create new ones or edit existing ones. This ensures data integrity while enforcing the new module-based access control.
---

## Phase 8 — Branch Request Flow

### 8.1 Server actions `app/(dashboard)/branch-requests/actions.ts`

```typescript
'use server';

import { withActionAuth } from '@/lib/serverActionAuth';
import prisma from '@/lib/db';
import type { ModuleKey } from '@/types/modules';

// Superadmin submits a request for a new branch or new modules
export async function submitBranchRequest(data: {
  branchId?: string;       // null = new branch
  branchName?: string;
  requestedModules: ModuleKey[];
  reason?: string;
}) {
  return withActionAuth(['superadmin'], async ({ userId, tenantId }) => {
    const request = await prisma.branchRequest.create({
      data: {
        tenantId,
        requestedById: userId,
        branchId: data.branchId ?? null,
        branchName: data.branchName ?? null,
        requestedModules: data.requestedModules,
        reason: data.reason ?? null,
        status: 'pending',
      },
    });
    return { success: true, data: request };
  });
}

// Developer approves or rejects
export async function reviewBranchRequest(data: {
  requestId: string;
  decision: 'approved' | 'rejected';
  reviewNote?: string;
}) {
  return withActionAuth(['developer'], async ({ userId }) => {
    const req = await prisma.branchRequest.findUnique({
      where: { id: data.requestId },
    });
    if (!req) return { success: false, error: 'Request not found' };

    if (data.decision === 'approved') {
      if (req.branchId) {
        // Update modules on existing branch
        await prisma.branch.update({
          where: { id: req.branchId },
          data: { enabledModules: req.requestedModules },
        });
      } else {
        // Create new branch and assign to the requesting superadmin
        await prisma.branch.create({
          data: {
            tenantId: req.tenantId,
            superadminId: req.requestedById,
            name: req.branchName ?? 'New Branch',
            enabledModules: req.requestedModules,
            status: 'active',
          },
        });
      }
    }

    await prisma.branchRequest.update({
      where: { id: data.requestId },
      data: {
        status: data.decision,
        reviewedById: userId,
        reviewNote: data.reviewNote ?? null,
        reviewedAt: new Date(),
      },
    });

    return { success: true };
  });
}
```

### 8.2 New pages needed

| Path | Role | Purpose |
|---|---|---|
| `app/(dashboard)/branch-requests/page.tsx` | superadmin | Submit + view own requests |
| `app/admin/branch-requests/page.tsx` | developer | Review all pending requests |

---

## Phase 9 — Admin Module Assignment

### 9.1 Server action

```typescript
// app/admin/users/actions.ts (or app/(dashboard)/settings/actions.ts)

export async function assignAdminModules(data: {
  adminUserId: string;
  branchId: string;
  modules: ModuleKey[];
}) {
  return withActionAuth(['superadmin'], async ({ tenantId }) => {
    // Verify the admin belongs to this tenant + branch
    const admin = await prisma.user.findFirst({
      where: {
        id: data.adminUserId,
        tenantId,
        branchId: data.branchId,
        role: 'admin',
      },
    });
    if (!admin) return { success: false, error: 'Admin not found in this branch' };

    // Verify requested modules are a subset of branch modules
    const branch = await prisma.branch.findUnique({
      where: { id: data.branchId },
      select: { enabledModules: true },
    });
    const branchModules = (branch?.enabledModules as ModuleKey[]) ?? [];
    const invalid = data.modules.filter(m => !branchModules.includes(m));
    if (invalid.length > 0) {
      return { success: false, error: `Modules not enabled for this branch: ${invalid.join(', ')}` };
    }

    await prisma.userBranchModule.upsert({
      where: { userId_branchId: { userId: data.adminUserId, branchId: data.branchId } },
      update: { enabledModules: data.modules },
      create: {
        userId: data.adminUserId,
        branchId: data.branchId,
        enabledModules: data.modules,
      },
    });

    return { success: true };
  });
}
```

---

## Phase 10 — Agent: Allow Loan and Customer Creation

### 10.1 Update `app/(dashboard)/loans/actions.ts`

Find `withActionAuth` calls that restrict to `['admin', 'superadmin']` and add `'agent'`:

```typescript
// Before:
return withActionAuth(['admin', 'superadmin'], async (ctx) => { … });

// After:
return withActionAuth(['admin', 'superadmin', 'agent'], async (ctx) => { … });
```

Specifically update `saveLoan` / `createLoan` actions. The `branchId` must still
come from `ctx.branchId` (never from client input):

```typescript
export async function createLoan(data: LoanFormData) {
  return withActionAuth(['admin', 'superadmin', 'agent'], async ({ userId, tenantId, role, branchId }) => {
    if (!branchId) return { success: false, error: 'No active branch' };

    const loan = await prisma.loan.create({
      data: {
        tenantId,
        branchId,               // ← always from session context
        createdById: userId,
        appType: data.appType,  // ← agent picks module type from their branch
        // … rest of loan fields
      },
    });
    return { success: true, data: loan };
  });
}
```

### 10.2 Update `app/(dashboard)/customers/actions.ts`

Same pattern — add `'agent'` to `saveCustomer` action.

Note: agents creating customers still set `status: 'pending_review'`. The existing
approval flow handles the review. No change needed there.

### 10.3 Update `middleware.ts` — agent route access

`/loans` and `/customers` must be removed from `AGENT_BLOCKED` (already done in Phase 6).

Also update the existing agent new-customer edit redirect:

```typescript
// REMOVE this block — agents can now create customers freely:
// if (pathname.startsWith('/customers/new') && request.nextUrl.searchParams.has('edit')) {
//   return NextResponse.redirect(new URL('/customers', request.url));
// }

// KEEP: agents still can't directly edit existing customers (approval flow)
if (role === 'agent' && pathname.match(/^\/customers\/[^/]+\/edit/)) {
  return NextResponse.redirect(new URL('/customers', request.url));
}
```

---

## Phase 11 — Sidebar Module Gating

The sidebar must hide nav items for modules not in `getActiveModules()`.

### `components/layout/Sidebar.tsx` — update

```tsx
// In the server component portion of Sidebar (or its parent layout):
import { getActiveModules } from '@/lib/branch';
import { MODULE_ROUTES } from '@/types/modules';

const activeModules = await getActiveModules();

// Helper used in JSX:
function isRouteEnabled(path: string): boolean {
  // Dashboard, collection, approvals, settings always shown
  const alwaysVisible = ['/dashboard', '/collection', '/approvals', '/settings', '/notifications'];
  if (alwaysVisible.some(p => path.startsWith(p))) return true;

  return activeModules.some(mod =>
    MODULE_ROUTES[mod].some(r => path.startsWith(r))
  );
}

// In the nav item render:
{navItems.filter(item => isRouteEnabled(item.href)).map(item => (
  <NavItem key={item.href} {...item} />
))}
```

---

## Phase 12 — Developer Portal Updates

The `/admin` portal currently manages users and branches generically. It needs:

1. **Branch management page** — create branch, assign to superadmin, set modules
2. **Branch request review page** — approve/reject superadmin branch requests
3. **Tenant creation** — existing; no change needed

### New page: `app/admin/branch-requests/page.tsx`

```tsx
import prisma from '@/lib/db';
import { reviewBranchRequest } from './actions';

export default async function BranchRequestsPage() {
  const requests = await prisma.branchRequest.findMany({
    where: { status: 'pending' },
    include: {
      requestedBy: { select: { name: true, tenantId: true } },
      branch: { select: { name: true } },
      tenant: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Render table with Approve / Reject buttons
  // Each button calls reviewBranchRequest server action
}
```

---

## Phase 13 — Dashboard Data Scoping

Every dashboard query must scope to `branchId`. Most already do via `branchId` filter for admin role. The gap is superadmin — they previously saw all branches merged. Now they see the active branch only.

### `app/api/dashboard/route.ts`

```typescript
import { getActiveBranchId } from '@/lib/branch';

// Inside the GET handler:
const branchId = await getActiveBranchId();

// All queries now include branchId:
const loans = await prisma.loan.findMany({
  where: {
    tenantId,
    branchId: branchId ?? undefined,  // null = developer (no filter)
    // …
  },
});
```

Apply the same pattern to:
- `app/api/reports/route.ts`
- `app/api/customers/route.ts`
- `app/api/collection/route.ts`
- `app/(dashboard)/dashboard/page.tsx` (server component queries)
- All server actions that currently do `where: { tenantId }` without `branchId`

---

## Phase 14 — `lib/moduleGate.ts` — update for branch-aware gating

```typescript
// lib/moduleGate.ts — replace existing implementation

import { getActiveModules } from './branch';
import type { ModuleKey } from '@/types/modules';

export async function assertModuleEnabled(module: ModuleKey): Promise<void> {
  const modules = await getActiveModules();
  if (!modules.includes(module)) {
    throw new Error(`Module '${module}' is not enabled for this branch`);
  }
}

export async function isModuleEnabled(module: ModuleKey): Promise<boolean> {
  const modules = await getActiveModules();
  return modules.includes(module);
}
```

Replace all existing `assertTenantSubscriptionAccess` module checks in feature
actions (vehicles, chits, loans) with `assertModuleEnabled('autofinance')` etc.

---

## Phase 15 — Auth Token: Store `activeBranchId`

The JWT currently stores `branchId` (fixed for admin/agent). For superadmin,
`activeBranchId` is dynamic (cookie-driven), so it does NOT go in the JWT.
The branch cookie is read at request time by `getActiveBranchId()`.

No changes needed to `lib/auth.ts` JWT callbacks for this. The `branchId` field
in the JWT stays for admin/agent rows where it is fixed.

---

## Phase 16 — Seed Script Updates

### `prisma/seed.ts` — add developer user and branch module examples

```typescript
// Add developer user (platform-level, no tenantId needed — use a platform tenant)
const developer = await prisma.user.upsert({
  where: { tenantId_username: { tenantId: platformTenantId, username: 'developer' } },
  update: {},
  create: {
    tenantId: platformTenantId,
    name: 'Platform Developer',
    phone: '0000000000',
    username: 'developer',
    passwordHash: await hash('changeme', 10),
    role: 'developer',
    appType: 'microlending',
    status: 'active',
  },
});

// Example: Erode branch with vehicles + chitfunds
const erodeBranch = await prisma.branch.upsert({
  where: { tenantId_code: { tenantId: demoTenantId, code: 'ERODE' } },
  update: {},
  create: {
    tenantId: demoTenantId,
    superadminId: superadminUser.id,
    name: 'Erode',
    code: 'ERODE',
    enabledModules: ['autofinance', 'chitfunds'],
    status: 'active',
  },
});

// Example: Namakkal branch with microlending only
const namakkalBranch = await prisma.branch.upsert({
  where: { tenantId_code: { tenantId: demoTenantId, code: 'NAMAKKAL' } },
  update: {},
  create: {
    tenantId: demoTenantId,
    superadminId: superadminUser.id,
    name: 'Namakkal',
    code: 'NAMAKKAL',
    enabledModules: ['microlending'],
    status: 'active',
  },
});
```

---

## Summary: Files Changed

| File | Change type | Notes |
|---|---|---|
| `prisma/schema.prisma` | Modify + add | Branch gains `enabledModules`, `superadminId`; new `BranchRequest`, `UserBranchModule` models |
| `types/index.ts` | Modify | Add `activeBranchId` to JWT/Session types |
| `types/modules.ts` | **New file** | `ModuleKey`, `MODULE_LABELS`, `MODULE_ROUTES` |
| `lib/branch.ts` | **New file** | Branch context resolution, module helpers |
| `lib/tenant.ts` | Modify | `getUserAppType` rewritten; subscription bypass for `/branch-requests` |
| `lib/serverActionAuth.ts` | Modify | `ActionContext` gains `branchId`, `modules` |
| `lib/moduleGate.ts` | Modify | Rewritten to use branch-derived module list |
| `middleware.ts` | Modify | Role guards updated; `active_branch_id` header injection |
| `components/layout/BranchSwitcher.tsx` | **New file** | Branch selector dropdown for superadmin |
| `components/layout/Sidebar.tsx` | Modify | Module-gated nav items |
| `app/(dashboard)/layout.tsx` | Modify | Load branches + active branch; mount switcher |
| `app/(dashboard)/actions/branch.ts` | **New file** | `switchActiveBranch` server action |
| `app/(dashboard)/branch-requests/` | **New directory** | Superadmin request submission page + actions |
| `app/(dashboard)/loans/actions.ts` | Modify | Add `'agent'` to allowed roles for create |
| `app/(dashboard)/customers/actions.ts` | Modify | Add `'agent'` to allowed roles for create |
| `app/admin/branch-requests/` | **New directory** | Developer review page + actions |
| `app/admin/branches/` | Modify | Add module assignment UI |
| `app/api/dashboard/route.ts` | Modify | Scope to `activeBranchId` |
| `app/api/reports/route.ts` | Modify | Scope to `activeBranchId` |
| `app/api/customers/route.ts` | Modify | Scope to `activeBranchId` |
| `app/api/collection/route.ts` | Modify | Scope to `activeBranchId` |
| `prisma/seed.ts` | Modify | Developer user, branch module examples |

---

## Testing Checklist

After completing all phases, verify:

- [ ] Developer logs in → redirected to `/admin`, cannot access `/dashboard`
- [ ] Developer can create a tenant and assign a branch with modules
- [ ] Developer can approve/reject branch requests
- [ ] Superadmin with two branches sees branch switcher in topbar
- [ ] Switching branch reloads dashboard with different customer/loan counts
- [ ] Superadmin in Erode (vehicles+chitfunds) sees `/vehicles` and `/chits` but not `/loans`
- [ ] Superadmin in Namakkal (microlending) sees `/loans` but not `/vehicles` or `/chits`
- [ ] Admin assigned only `chitfunds` module cannot navigate to `/loans`
- [ ] Agent can create a customer (status `pending_review`)
- [ ] Agent can create a loan (branchId comes from session, not form)
- [ ] Agent editing a customer routes through approval request, not direct save
- [ ] Borrower can view their loan but cannot access any staff route
- [ ] A loan created in Erode branch does not appear in Namakkal dashboard
- [ ] Cross-tenant data access still returns 404

---


