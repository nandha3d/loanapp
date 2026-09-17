- The current structure is `app/(dashboard)/[page]/` → URLs like `/dashboard`, `/loans`, `/collection`
- The target is `app/(dashboard)/[module]/[page]/` → URLs like `/microlending/dashboard`, `/chitfunds/chits`, `/autofinance/vehicles`
- The `active_app_type` cookie approach gets replaced by the URL slug itself
- All roles (superadmin, admin, agent, developer, borrower/customer) need correct module access per URL

This is a large but well-defined refactor. Here is every file that needs to change and exactly what to do in each one.

---

## The Full Change Set

### The Core Idea

Replace the `active_app_type` cookie with the URL segment. Every protected page moves from:

```
app/(dashboard)/loans/page.tsx        → /loans
app/(dashboard)/chits/page.tsx        → /chits
```

to:

```
app/(dashboard)/[module]/loans/page.tsx    → /microlending/loans
app/(dashboard)/[module]/chits/page.tsx    → /chitfunds/chits
app/(dashboard)/[module]/dashboard/page.tsx → /microlending/dashboard
```

The `[module]` segment is the source of truth — no more cookie needed to know which module is active.

---

### Step 1 — Restructure the `(dashboard)` folder

Move every page folder **one level deeper** under a `[module]` dynamic segment:

```
app/(dashboard)/
  [module]/
    layout.tsx          ← moved here, reads params.module
    dashboard/page.tsx
    loans/
      page.tsx
      [id]/page.tsx
    customers/
      page.tsx
      [id]/page.tsx
    collection/page.tsx
    penalties/page.tsx
    reports/page.tsx
    settings/page.tsx
    accounting/page.tsx
    analytics/page.tsx
    approvals/page.tsx
    notifications/page.tsx
    subscription/page.tsx
    branch-requests/page.tsx
    chits/
      page.tsx
      [id]/page.tsx
    vehicles/
      page.tsx
      [id]/page.tsx
```

The route group `(dashboard)` stays — it just gains a `[module]` child.

---

### Step 2 — `app/(dashboard)/[module]/layout.tsx`

This replaces the current `app/(dashboard)/layout.tsx`. It receives `params.module` directly from the URL instead of reading the `active_app_type` cookie:

```typescript
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { ALL_MODULES, MODULE_ROUTES, type ModuleKey } from '@/types/modules';
import { getDefaultTenantId } from '@/lib/tenant';
import { getActiveModules, getActiveBranchId, getSuperadminBranches } from '@/lib/branch';
import { normalizeModuleList } from '@/types/modules';
import { getAppConfig } from '@/lib/appConfig';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';

// Role → which modules they can access
const ROLE_MODULE_ACCESS: Record<string, ModuleKey[] | 'all'> = {
  developer:   'all',
  superadmin:  'all',      // filtered by branch below
  admin:       'all',      // filtered by branch below
  agent:       'all',      // filtered by UserBranchModule below
};

// Pages inside a module that each role can reach
const AGENT_BLOCKED_PAGES = [
  'penalties', 'reports', 'settings', 'accounting', 'analytics', 'subscription',
];

export default async function ModuleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { module: string };
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = session.user as any;
  const role: string = user.role;
  const requestedModule = params.module as ModuleKey;

  // 1. Validate the module slug exists at all
  if (!ALL_MODULES.includes(requestedModule)) {
    notFound();
  }

  const tenantId = await getDefaultTenantId();

  // 2. Resolve which modules this user/role/branch can access
  let allowedModules: ModuleKey[];

  if (role === 'developer') {
    allowedModules = [...ALL_MODULES];
  } else if (role === 'superadmin') {
    const activeBranchId = await getActiveBranchId();
    const branches = await getSuperadminBranches(tenantId, user.id);
    const activeBranch = branches.find(b => b.id === activeBranchId) ?? branches[0];
    allowedModules = activeBranch
      ? normalizeModuleList(activeBranch.enabledModules)
      : [...ALL_MODULES];
  } else {
    // admin and agent: scoped to their branch's enabled modules
    allowedModules = await getActiveModules();
  }

  // 3. Gate: user cannot access a module not enabled for their branch
  if (!allowedModules.includes(requestedModule)) {
    // Redirect to their first allowed module instead of a blank error
    const fallback = allowedModules[0];
    if (fallback) redirect(`/${fallback}/dashboard`);
    redirect('/portal');
  }

  // appConfig drives theming
  const appConfig = getAppConfig(requestedModule);

  return (
    <div
      className="app-layout"
      style={{
        '--primary':      appConfig.primaryColor,
        '--primary-dark': appConfig.primaryDark,
        '--primary-light':appConfig.primaryLight,
        '--accent':       appConfig.accentColor,
      } as React.CSSProperties}
    >
      <Sidebar
        appType={requestedModule}
        enabledModules={allowedModules}
        role={role}
        userName={user.name ?? 'User'}
        // pass module prefix so all links are /{module}/page
        modulePrefix={`/${requestedModule}`}
      />
      <main className="main-content">
        <Topbar ... />
        <div className="page-content fade-up">
          {children}
        </div>
      </main>
    </div>
  );
}
```

---

### Step 3 — `portal/actions.ts` — remove the `/dashboard` redirect

Change the final line of `selectApp` from:

```typescript
redirect('/dashboard');
```

to:

```typescript
redirect(`/${appType}/dashboard`);
```

That's the only change needed in this file. The `active_app_type` cookie can stay for now as a fallback but is no longer the routing authority.

---

### Step 4 — `app/page.tsx` — root redirect per role

Update every `redirect('/dashboard')` to include the module:

```typescript
export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const role = (session.user as any).role;

  if (role === 'developer' || role === 'superadmin') {
    redirect('/portal');
  }

  if (role === 'admin' || role === 'agent') {
    const { getActiveModules } = await import('@/lib/branch');
    const modules = await getActiveModules();
    if (modules.length > 1) redirect('/portal');
    const mod = modules[0] ?? 'microlending';
    // Agent goes directly to collection, admin to dashboard
    const page = role === 'agent' ? 'collection' : 'dashboard';
    redirect(`/${mod}/${page}`);
  }

  redirect('/portal');
}
```

---

### Step 5 — `middleware.ts` — understand module-prefixed paths

The middleware currently redirects based on flat paths like `/collection`, `/penalties`. With the new structure every path is `/{module}/{page}`. Update it to strip the module prefix before doing role checks:

```typescript
// Helper to extract module and page from new URL structure
function parseModulePath(pathname: string): { module: string | null; page: string } {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length >= 1 && ALL_MODULES.includes(parts[0] as any)) {
    return { module: parts[0], page: '/' + parts.slice(1).join('/') };
  }
  return { module: null, page: pathname };
}

export function getRoleRedirectTarget(pathname: string, role: string): string | null {
  const { module, page } = parseModulePath(pathname);

  if (role === 'developer') {
    // Developer must go through /portal or /admin only
    if (!pathname.startsWith('/admin') && !pathname.startsWith('/portal') && module === null) {
      return '/admin';
    }
    return null;
  }

  if (role === 'superadmin') {
    if (pathname.startsWith('/admin')) {
      const allowed = ['/admin/users', '/admin/branches', '/admin/branch-requests'];
      if (allowed.some(p => pathname.startsWith(p))) return null;
      return '/portal';
    }
    return null;
  }

  if (role === 'admin') {
    if (pathname.startsWith('/admin')) {
      if (pathname.startsWith('/admin/team')) return null;
      return '/portal';
    }
    return null;
  }

  if (role === 'agent') {
    // Agents blocked from certain pages within any module
    const AGENT_BLOCKED_PAGES = ['penalties', 'reports', 'settings', 'accounting', 'analytics', 'subscription', 'portal'];
    if (module && AGENT_BLOCKED_PAGES.some(p => page.startsWith('/' + p))) {
      return `/${module}/collection`;
    }
    if (!module && AGENT_BLOCKED_PAGES.some(p => pathname.startsWith('/' + p))) {
      return '/portal'; // will resolve to their module
    }
    // Agent cannot edit customers directly
    if (page.match(/^\/customers\/[^/]+\/edit/)) {
      return `/${module}/customers`;
    }
    return null;
  }

  return null;
}
```

---

### Step 6 — `components/layout/Sidebar.tsx` — prefix all hrefs with module

The Sidebar receives a `modulePrefix` prop (e.g. `/microlending`) and prepends it to every `href`:

```typescript
// Before
{ id: 'dashboard', href: '/dashboard' }
{ id: 'loans',     href: '/loans' }

// After — done once, dynamically
const navItems = RAW_NAV_ITEMS.map(item =>
  item.href ? { ...item, href: `${modulePrefix}${item.href}` } : item
);
```

The `usePathname()` active-link check also needs updating — strip the module prefix before comparing:

```typescript
const pageSegment = pathname.replace(modulePrefix, '') || '/dashboard';
const isActive = item.href === `${modulePrefix}${pageSegment}`;
```

---

### Step 7 — `portal/AppSelectorClient.tsx` — no change needed

The `handleSelectApp` calls `selectApp(appType)` which now redirects to `/${appType}/dashboard`. The portal itself stays at `/portal`. Nothing else changes in this file.

---

### Step 8 — `types/modules.ts` — add URL slug map

Add a canonical slug for each module that matches the URL segment exactly:

```typescript
export const MODULE_SLUGS: Record<ModuleKey, string> = {
  microlending: 'microlending',
  autofinance:  'autofinance',
  chitfunds:    'chitfunds',
};

// Helper for building module-prefixed paths
export function modulePath(module: ModuleKey, page: string): string {
  return `/${module}${page.startsWith('/') ? page : '/' + page}`;
}
```

---

### Step 9 — Role access matrix (what each role sees per module)

| Role | Portal | Module URL | Pages accessible |
|---|---|---|---|
| **superadmin** | `/portal` (module picker) | `/microlending/*`, `/autofinance/*`, `/chitfunds/*` | All pages in any module their branch enables |
| **admin** | `/portal` if multi-module | `/{module}/dashboard` through `/{module}/settings` | All pages except `/admin/users`, `/admin/branches` |
| **agent** | No portal | `/{module}/collection` (entry point) | `dashboard`, `collection`, `customers`, `loans`, `approvals`, `notifications` only |
| **developer** | `/portal` (all modules) | Any `/{module}/*` + `/admin/*` | Everything |
| **borrower/customer** | `/borrower/dashboard` | `/borrower/*` only | Their own loan data — completely separate from `(dashboard)` group, no change needed |

---

### Step 10 — `lib/tenant.ts` — deprecate `getUserAppType` cookie read

With the module in the URL, `getUserAppType` should read from the path instead of the cookie. Change it to:

```typescript
export async function getUserAppType(): Promise<string> {
  const headerStore = await headers();
  const pathname = headerStore.get('x-zolofund-path') || '';

  // New: module is the first path segment
  const firstSegment = pathname.split('/').filter(Boolean)[0];
  if (firstSegment && ALL_MODULES.includes(firstSegment as any)) {
    return firstSegment;
  }

  // Legacy fallback for any remaining cookie-based flows
  const cookieStore = await cookies();
  return cookieStore.get('active_app_type')?.value || 'microlending';
}
```

---

### What does NOT change

- `/portal` — stays exactly as is
- `/admin/*` — stays exactly as is  
- `/borrower/*` — completely separate, no change
- `/api/*` — no change, APIs don't use module slugs
- `/login` — no change
- The Prisma schema — no change
- The `active_app_type` cookie — can stay as a legacy fallback, just no longer drives routing

---

### Summary of files to modify

| File | Change |
|---|---|
| `app/(dashboard)/layout.tsx` | Move to `app/(dashboard)/[module]/layout.tsx`, read `params.module` |
| All page folders inside `(dashboard)` | Move one level deeper into `[module]/` |
| `app/page.tsx` | Redirect to `/{module}/dashboard` or `/{module}/collection` |
| `app/portal/actions.ts` | Change `redirect('/dashboard')` → `redirect('/${appType}/dashboard')` |
| `middleware.ts` | Parse module prefix from pathname before role checks |
| `components/layout/Sidebar.tsx` | Accept `modulePrefix` prop, prepend to all hrefs |
| `lib/tenant.ts` `getUserAppType` | Read module from path segment first, cookie as fallback |
| `types/modules.ts` | Add `modulePath()` helper |