# RBAC, Security and Isolation Requirements

## 1. Role Definitions

| Role | Scope | Key Access |
|---|---|---|
| `developer` | Technical/internal role | All apps, admin portal, branch setup, seed/debug support |
| `superadmin` | Business platform owner | App selector, master users, all app data within tenant |
| `admin` | Application admin | One app type, branch-limited for Micro Lending |
| `agent` | Field collection user | Own/shared route customers and collection only |
| `borrower` | Future self-service | Own profile/loan view only |

---

## 2. Target Page Access Matrix

| Route | Developer | Super Admin | Admin | Agent | Notes |
|---|---:|---:|---:|---:|---|
| `/portal` | ✅ | ✅ | ❌ | ❌ | App selection |
| `/admin/users` | ✅ | ✅ | ❌ | ❌ | Master user management |
| `/admin/branches` | ✅ | ✅ | ❌ | ❌ | Branch management, ML only |
| `/dashboard` | ✅ | ✅ | ✅ | ❌ | Agent redirects to collection |
| `/customers` | ✅ | ✅ | ✅ | ✅ read-only | Agent only assigned/shared route customers |
| `/customers/new` | ✅ | ✅ | ✅ | ✅ create only | Agent creation = pending review |
| `/customers/[id]` | ✅ | ✅ | ✅ | ✅ read-only | Agent cannot edit or create loan |
| `/customers/new?edit=` | ✅ | ✅ | ✅ | ❌ | Agent must raise approval request |
| `/loans` | ✅ | ✅ | ✅ | ❌ | Admin only |
| `/loans/new` | ✅ | ✅ | ✅ | ❌ | Admin only |
| `/loans/[id]` | ✅ | ✅ | ✅ | ❌ | Admin only |
| `/collection` | ✅ | ✅ | ✅ | ✅ | Agent primary page |
| `/penalties` | ✅ | ✅ | ✅ | ❌ | Admin only |
| `/reports` | ✅ | ✅ | ✅ | ❌ | Admin only |
| `/notifications` | ✅ | ✅ | ✅ | ✅ | Filtered by app and user scope |
| `/settings` | ✅ | ✅ | ✅ | ❌ | Admin manages own app settings |
| `/approvals` | ✅ | ✅ | ✅ | ✅ own requests | Admin reviews; agent views own requests |

---

## 3. Middleware Alignment Required

Current middleware treats `/customers` and `/approvals` as admin routes. This conflicts with the target matrix because agents should access customers read-only and view own approvals.

Recommended middleware route groups:

```ts
const superAdminRoutes = ['/portal', '/admin'];
const adminOnlyRoutes = ['/dashboard', '/loans', '/penalties', '/reports', '/settings'];
const sharedRoutes = ['/customers', '/collection', '/notifications', '/approvals'];
```

Rules:

- Agent accessing `/dashboard`, `/loans`, `/penalties`, `/reports`, `/settings` → redirect `/collection`.
- Agent accessing `/customers/new?edit=` → redirect customer profile or approval request page.
- Agent accessing `/customers` → allowed, but server-side query must be route-scoped.
- Agent accessing `/approvals` → allowed, but query must filter by `requestedById`.

---

## 4. Server-Side Permission Rules

Do not rely only on middleware. Every server action must validate the session.

### Customer Actions

| Action | Developer/Superadmin | Admin | Agent |
|---|---:|---:|---:|
| Create customer | ✅ | ✅ | ✅ pending review |
| Edit customer | ✅ | ✅ | ❌ direct edit blocked |
| View customer | ✅ | ✅ | ✅ assigned/shared routes only |
| Delete customer | ❌ | ❌ | ❌ |
| Request edit | ❌ optional | ❌ optional | ✅ |

### Loan Actions

| Action | Developer/Superadmin | Admin | Agent |
|---|---:|---:|---:|
| Create loan | ✅ | ✅ | ❌ |
| View loan | ✅ | ✅ | ❌ |
| Mark instalment paid from loan detail | ✅ | ✅ | ❌ |
| Close loan | ✅ | ✅ | ❌ |

### Collection Actions

| Action | Developer/Superadmin | Admin | Agent |
|---|---:|---:|---:|
| View collection page | ✅ | ✅ | ✅ |
| Submit collection | ✅ | ✅ | ✅ assigned/shared route only |
| Edit locked entry | Optional | Optional | ❌ except configured edit window |

---

## 5. Isolation Checklist

Every data access must answer these questions:

| Question | Required Answer |
|---|---|
| Is the user authenticated? | Yes |
| What is the user's `tenantId`? | From session or tenant resolver |
| What is the current `appType`? | From session/cookie helper |
| Is branch restriction required? | Yes for Micro Lending admin |
| Is route restriction required? | Yes for agent customer/collection access |
| Is the entity in same app? | Must be verified |
| Is the entity in same tenant? | Must be verified |
| Should wrong app data return 403 or 404? | Prefer 404/not found to avoid leakage |

---

## 6. Critical Security Fixes

### 6.1 Do Not Trust `appType` From Form Data

Current loan action reads:

```ts
const appType = (formData.get('appType') as string) || sessionAppType;
```

Recommended:

```ts
const appType = await getUserAppType();
```

The server must own app context.

---

### 6.2 Use `findFirst` With Full Ownership Filter for Mutations

Example:

```ts
const customer = await prisma.customer.findFirst({
  where: { id: customerId, tenantId, appType },
});

if (!customer) {
  return { success: false, error: 'Customer not found' };
}
```

---

### 6.3 Field Allow-List for Approval Requests

Never apply arbitrary JSON directly:

```ts
const allowedCustomerFields = ['name', 'phone', 'address', 'routeId'];
const safeChanges = Object.fromEntries(
  Object.entries(changes).filter(([key]) => allowedCustomerFields.includes(key))
);
```

---

### 6.4 Agent Route Validation for Collection

Agent can collect only if:

- Customer is on one of agent's assigned `RouteAgent` routes, or
- Customer is explicitly assigned to that agent as fallback during transition.

Recommended helper:

```ts
async function getAgentRouteIds(agentId: string) {
  const routeAgents = await prisma.routeAgent.findMany({
    where: { agentId },
    select: { routeId: true },
  });
  return routeAgents.map(r => r.routeId);
}
```

---

## 7. API Route Security

API routes must apply the same security as pages.

Current API gaps:

| API | Gap | Fix |
|---|---|---|
| `/api/customers` | tenant-only filter | Add `appType`, branch, role route scope |
| `/api/loans` | tenant-only filter | Add `appType`, branch, admin-only restriction |
| `/api/notifications` | no auth check and no appType | Require auth, add `appType` field/filter |

---

## 8. Password and Session Requirements

Minimum recommended standards:

- Password hash cost should be consistent. Current code uses cost 12 in seed/settings and 10 in admin action. Standardize to 12.
- Enforce minimum password length and complexity for admin-created users.
- Do not allow inactive/suspended users to log in.
- Add login audit entry.
- Add logout audit entry if possible.

---

## 9. Production Security Checklist

| Check | Required Before Release |
|---|---:|
| All server actions have auth checks | ✅ |
| All queries include tenant and app filters | ✅ |
| Branch filter applied for ML admins | ✅ |
| Agent route filter applied | ✅ |
| Middleware matches route matrix | ✅ |
| API routes hardened | ✅ |
| No form-provided tenant/app/agent IDs trusted blindly | ✅ |
| File uploads validate MIME/size/path | ✅ |
| Audit logging complete | ✅ |
| Superadmin/developer cannot be created by normal admin | ✅ |
