# Code Fix Guide and Recommended Patches

This document lists recommended patches for the current zip implementation.

---

## 1. Fix `settings/page.tsx` Build Issue

### File

```text
app/(dashboard)/settings/page.tsx
```

### Current Issue

`userRole` is referenced before declaration.

### Patch

```ts
export default async function SettingsPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role;

  if (userRole !== 'admin' && userRole !== 'superadmin' && userRole !== 'developer') {
    redirect('/dashboard');
  }

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  // existing logic continues...
}
```

---

## 2. Update Middleware Route Groups

### File

```text
middleware.ts
```

### Recommended Logic

```ts
const superAdminRoutes = ['/portal', '/admin'];
const adminOnlyRoutes = ['/dashboard', '/loans', '/penalties', '/reports', '/settings'];
const sharedRoutes = ['/customers', '/collection', '/notifications', '/approvals'];

if (superAdminRoutes.some(route => pathname.startsWith(route))) {
  if (role !== 'superadmin' && role !== 'developer') {
    return NextResponse.redirect(new URL(role === 'agent' ? '/collection' : '/dashboard', request.url));
  }
}

if (adminOnlyRoutes.some(route => pathname.startsWith(route))) {
  if (role !== 'admin' && role !== 'superadmin' && role !== 'developer') {
    return NextResponse.redirect(new URL('/collection', request.url));
  }
}

if (role === 'agent' && pathname.startsWith('/customers/new') && request.nextUrl.searchParams.has('edit')) {
  return NextResponse.redirect(new URL('/customers', request.url));
}
```

---

## 3. Add AppType to Notifications

### Prisma Patch

```prisma
model SystemNotification {
  id        String   @id @default(cuid())
  tenantId  String   @map("tenant_id")
  appType   String   @default("microlending") @map("app_type")
  type      String
  icon      String?
  title     String?
  message   String   @db.Text
  link      String?
  isRead    Boolean  @default(false) @map("is_read")
  readAt    DateTime? @map("read_at")
  expiresAt DateTime? @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, appType, isRead])
  @@index([createdAt])
  @@map("system_notifications")
}
```

After schema change:

```bash
npx prisma migrate dev --name add-notification-app-type
npx prisma generate
```

### Notifications Page Patch

```ts
const notifications = await prisma.systemNotification.findMany({
  where: { tenantId, appType },
  orderBy: { createdAt: 'desc' },
});
```

### Mark Read Action Patch

```ts
const appType = await getUserAppType();

await prisma.systemNotification.updateMany({
  where: { id, tenantId, appType },
  data: { isRead: true, readAt: new Date() },
});
```

Use `updateMany` because it safely handles scoped where filters.

---

## 4. Harden `createLoan()`

### File

```text
app/(dashboard)/loans/actions.ts
```

### Key Changes

- Remove form-provided `appType`.
- Validate session role.
- Validate customer ownership.
- Validate package ownership.

### Patch Pattern

```ts
const session = await auth();
const role = (session?.user as any)?.role;
const createdById = (session?.user as any)?.id;
const tenantId = await getDefaultTenantId();
const appType = await getUserAppType();

if (!createdById || role === 'agent') {
  return { success: false, error: 'Unauthorized' };
}

const customer = await prisma.customer.findFirst({
  where: { id: customerId, tenantId, appType, status: 'active' },
});

if (!customer) {
  return { success: false, error: 'Customer not found or not approved' };
}

if (packageId) {
  const pkg = await prisma.loanPackage.findFirst({
    where: { id: packageId, tenantId, appType, status: 'active' },
  });
  if (!pkg) return { success: false, error: 'Loan package not found' };
}
```

---

## 5. Implement RouteAgent-Based Collection Scope

### Helper

Create a helper in `lib/access.ts`:

```ts
import prisma from '@/lib/db';

export async function getAgentRouteIds(agentId: string) {
  const rows = await prisma.routeAgent.findMany({
    where: { agentId },
    select: { routeId: true },
  });
  return rows.map(r => r.routeId);
}
```

### Collection Page Patch

```ts
const customerFilter: any = { tenantId, appType };

if (userRole === 'agent') {
  const routeIds = await getAgentRouteIds(userId);
  customerFilter.OR = [
    { routeId: { in: routeIds } },
    { agentId: userId }, // fallback during migration
  ];
}
```

### Submit Collection Validation

Before accepting payment:

```ts
if (userRole === 'agent') {
  const routeIds = await getAgentRouteIds(userId);
  const customerRouteId = instalment.loan.customer.routeId;
  const explicitlyAssigned = instalment.loan.customer.agentId === userId;

  if (!explicitlyAssigned && (!customerRouteId || !routeIds.includes(customerRouteId))) {
    return { success: false, error: 'You are not assigned to this route' };
  }
}
```

---

## 6. Fix DailyCollection Lookup

### Current Risk

`findFirst` uses only `agentId` and date.

### Patch

```ts
let dailyCollection = await prisma.dailyCollection.findFirst({
  where: { tenantId, appType, agentId: userId, date: today },
});
```

### Recommended Schema Improvement

```prisma
@@unique([tenantId, appType, agentId, date])
```

Remove or replace old:

```prisma
@@unique([agentId, date])
```

---

## 7. Harden Customer Detail and Loan Detail Pages

### Customer Detail

```ts
const customer = await prisma.customer.findFirst({
  where: {
    id: resolvedParams.id,
    tenantId,
    appType,
    ...(userRole === 'agent' ? { routeId: { in: assignedRouteIds } } : {}),
  },
  include: { ... },
});
```

### Loan Detail

```ts
const loan = await prisma.loan.findFirst({
  where: { id: resolvedParams.id, tenantId, appType },
  include: { ... },
});
```

---

## 8. Hide Agent-Restricted UI Actions

### Customer Profile Client

Pass `userRole` from server to client.

```tsx
{userRole !== 'agent' && (
  <Link href={`/customers/new?edit=${customer.id}`} className="btn btn-secondary btn-sm">Edit</Link>
)}

{userRole !== 'agent' && (
  <Link href={`/loans/new?customerId=${customer.id}`} className="btn btn-primary btn-sm">New Loan</Link>
)}

{userRole === 'agent' && (
  <button className="btn btn-secondary btn-sm">Request Edit</button>
)}
```

---

## 9. Harden Approval Review

### Current Risk

Requested changes are applied directly.

### Patch Pattern

```ts
const request = await prisma.approvalRequest.findFirst({
  where: { id: requestId, tenantId, appType, status: 'pending' },
});

const targetCustomer = await prisma.customer.findFirst({
  where: { id: request.entityId, tenantId, appType },
});

if (!targetCustomer) return { success: false, error: 'Customer not found' };

const changes = JSON.parse(request.requestedChanges);
const allowedFields = ['name', 'phone', 'address', 'routeId'];
const safeChanges = Object.fromEntries(
  Object.entries(changes).filter(([key]) => allowedFields.includes(key))
);

await prisma.customer.update({
  where: { id: targetCustomer.id },
  data: safeChanges,
});
```

---

## 10. Harden Admin User Management

Rules:

- Only developer can create developer.
- Superadmin can create admin/agent but not developer.
- Admin can create only agent in own app.
- Password hash cost should be standardized to 12.

Patch rule:

```ts
if (userRole === 'superadmin' && role === 'developer') {
  return { success: false, error: 'Only developer can create developer users' };
}
```

---

## 11. Add Audit Helper

Create `lib/audit.ts`:

```ts
import prisma from '@/lib/db';

export async function auditLog({ tenantId, userId, action, entityType, entityId, oldValue, newValue }: any) {
  return prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action,
      entityType,
      entityId,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
    },
  });
}
```

Use this in every mutation.

---

## 12. Add Superadmin and Developer to Seed

```ts
const developerPassword = await hash('dev123', 12);
await prisma.user.upsert({
  where: { tenantId_username: { tenantId: tenant.id, username: 'developer' } },
  update: { passwordHash: developerPassword },
  create: {
    tenantId: tenant.id,
    name: 'Developer User',
    phone: '9000000001',
    username: 'developer',
    passwordHash: developerPassword,
    role: 'developer',
    appType: 'microlending',
    status: 'active',
  },
});

const superPassword = await hash('super123', 12);
await prisma.user.upsert({
  where: { tenantId_username: { tenantId: tenant.id, username: 'superadmin' } },
  update: { passwordHash: superPassword },
  create: {
    tenantId: tenant.id,
    name: 'Super Admin',
    phone: '9000000002',
    username: 'superadmin',
    passwordHash: superPassword,
    role: 'superadmin',
    appType: 'microlending',
    status: 'active',
  },
});
```
