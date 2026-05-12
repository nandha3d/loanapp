# Future Phases — Implementation Guide

> This document covers everything that is **not yet built** in the current codebase.  
> Each phase is a self-contained implementation spec with schema, file list, and acceptance criteria.

---

## Phase 2 — Auto Finance Module

### Overview
The Auto Finance module tracks vehicle loans (two-wheeler / four-wheeler). It uses the same tenant/branch/agent structure as Micro Lending but has vehicle-specific data, RC/insurance document tracking, and a repossession flag when EMIs are severely overdue.

---

### 2.1 — Prisma Schema Changes

Add to **`prisma/schema.prisma`**:

```prisma
model Vehicle {
  id             String    @id @default(cuid())
  tenantId       String    @map("tenant_id")
  customerId     String    @map("customer_id")
  loanId         String?   @unique @map("loan_id")

  make           String                        // e.g. Honda
  model          String                        // e.g. Activa 6G
  year           Int
  registrationNo String    @map("registration_no")
  engineNo       String?   @map("engine_no")
  chassisNo      String?   @map("chassis_no")
  colour         String?
  vehicleType    String    @default("two_wheeler") @map("vehicle_type")
  // two_wheeler | four_wheeler | commercial

  rcDocPath      String?   @map("rc_doc_path")
  insurancePath  String?   @map("insurance_path")
  insuranceExpiry DateTime? @map("insurance_expiry")

  repoFlag       Boolean   @default(false) @map("repo_flag")
  repoFlaggedAt  DateTime? @map("repo_flagged_at")
  repoFlaggedById String?  @map("repo_flagged_by_id")

  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  tenant         Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  customer       Customer  @relation(fields: [customerId], references: [id])
  loan           Loan?     @relation(fields: [loanId], references: [id])
  repoFlaggedBy  User?     @relation("VehicleRepoFlag", fields: [repoFlaggedById], references: [id])

  @@index([tenantId, customerId])
  @@index([registrationNo])
  @@map("vehicles")
}
```

Add `vehicles Vehicle[]` relation to `Customer` and `Loan` models.  
Add `vehicleRepoFlags Vehicle[] @relation("VehicleRepoFlag")` to `User` model.

---

### 2.2 — New Files to Create

```
app/(dashboard)/vehicles/
  page.tsx                  ← Vehicle list (admin) / repo flagged list
  [id]/
    page.tsx                ← Vehicle detail + loan link
    VehicleDetailClient.tsx
  new/
    page.tsx
    VehicleForm.tsx         ← Make, model, year, reg no, RC upload, insurance
  actions.ts                ← createVehicle, updateVehicle, flagForRepo, clearRepoFlag
```

---

### 2.3 — `actions.ts` Key Functions

```ts
// app/(dashboard)/vehicles/actions.ts

export async function createVehicle(formData: FormData) {
  // Validate admin/superadmin role
  // Create Vehicle record linked to customerId and optionally loanId
  // Write AuditLog
}

export async function flagForRepo(vehicleId: string, reason: string) {
  // Admin only
  // Set repoFlag = true, repoFlaggedAt = now(), repoFlaggedById = userId
  // Create SystemNotification: type='danger', title='Repo Flag Set'
  // Write AuditLog
}

export async function clearRepoFlag(vehicleId: string) {
  // Admin only
  // Set repoFlag = false, clear flaggedAt/flaggedBy
  // Write AuditLog
}
```

---

### 2.4 — Dashboard Integration

In `app/(dashboard)/dashboard/page.tsx`, when `appType === 'autofinance'`:

- Add a **Repo Flagged** count card: `prisma.vehicle.count({ where: { tenantId, repoFlag: true } })`
- Add an **Insurance Expiring Soon** card: vehicles with `insuranceExpiry` within 30 days

---

### 2.5 — Sidebar Integration

In `components/layout/Sidebar.tsx`, when `appType === 'autofinance'`:

```tsx
{appType === 'autofinance' && (
  <Link href="/vehicles">
    <span className="material-icons-outlined">directions_car</span>
    Vehicles
  </Link>
)}
```

---

### 2.6 — Acceptance Criteria
- [ ] Admin can create a vehicle and link it to a customer + loan
- [ ] RC and insurance document filenames stored (file upload — see Phase 4)
- [ ] Admin can flag a vehicle for repossession with a reason
- [ ] Repo-flagged vehicles appear highlighted on the vehicle list
- [ ] Dashboard shows repo count when appType is autofinance
- [ ] Clearing repo flag removes the flag and writes audit log

---

## Phase 3 — Chit Fund Module

### Overview
Chit Funds are rotating savings groups. A group of N members each contributes a fixed amount per period. In each period, one member wins the auction (typically by bidding the lowest prize). The remaining amount (after the winning discount and organizer commission) is distributed equally.

---

### 3.1 — Prisma Schema Changes

Add to **`prisma/schema.prisma`**:

```prisma
model ChitGroup {
  id            String    @id @default(cuid())
  tenantId      String    @map("tenant_id")
  branchId      String?   @map("branch_id")
  appType       String    @default("chitfunds") @map("app_type")

  name          String
  chitValue     Decimal   @map("chit_value")       // Total chit amount e.g. 100000
  monthlyContrib Decimal  @map("monthly_contrib")  // Per member per period
  totalMembers  Int       @map("total_members")     // N members
  durationMonths Int      @map("duration_months")   // = totalMembers
  commissionPct Decimal   @default(5) @map("commission_pct") // Organizer %
  startDate     DateTime  @map("start_date")
  status        String    @default("active")        // active | completed | cancelled

  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  tenant        Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  branch        Branch?   @relation(fields: [branchId], references: [id])
  members       ChitMember[]
  auctions      ChitAuction[]

  @@index([tenantId, appType, status])
  @@map("chit_groups")
}

model ChitMember {
  id           String    @id @default(cuid())
  chitGroupId  String    @map("chit_group_id")
  customerId   String    @map("customer_id")
  memberNumber Int       @map("member_number")    // 1..N
  hasWon       Boolean   @default(false) @map("has_won")
  wonAt        DateTime? @map("won_at")
  joinedAt     DateTime  @default(now()) @map("joined_at")

  chitGroup    ChitGroup  @relation(fields: [chitGroupId], references: [id], onDelete: Cascade)
  customer     Customer   @relation(fields: [customerId], references: [id])
  subscriptions ChitSubscription[]

  @@unique([chitGroupId, customerId])
  @@unique([chitGroupId, memberNumber])
  @@map("chit_members")
}

model ChitAuction {
  id            String    @id @default(cuid())
  chitGroupId   String    @map("chit_group_id")
  periodNumber  Int       @map("period_number")    // Which month (1..N)
  auctionDate   DateTime  @map("auction_date")
  winnerMemberId String?  @map("winner_member_id")
  prizeAmount   Decimal?  @map("prize_amount")     // Amount won by winner
  bidDiscount   Decimal?  @map("bid_discount")     // chitValue - prizeAmount
  commission    Decimal?  // Organizer commission = bidDiscount * commissionPct/100
  dividend      Decimal?  // Per non-winner member = (bidDiscount - commission) / (N-1)
  status        String    @default("pending")       // pending | completed

  createdAt     DateTime  @default(now()) @map("created_at")

  chitGroup     ChitGroup  @relation(fields: [chitGroupId], references: [id], onDelete: Cascade)
  winnerMember  ChitMember? @relation(fields: [winnerMemberId], references: [id])

  @@unique([chitGroupId, periodNumber])
  @@map("chit_auctions")
}

model ChitSubscription {
  id           String    @id @default(cuid())
  memberId     String    @map("member_id")
  periodNumber Int       @map("period_number")
  dueDate      DateTime  @map("due_date")
  dueAmount    Decimal   @map("due_amount")
  paidAmount   Decimal   @default(0) @map("paid_amount")
  status       String    @default("upcoming")   // upcoming | paid | missed
  paidAt       DateTime? @map("paid_at")

  member       ChitMember @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@index([memberId, periodNumber])
  @@map("chit_subscriptions")
}
```

---

### 3.2 — New Files to Create

```
app/(dashboard)/chits/
  page.tsx                      ← Chit group list
  [id]/
    page.tsx                    ← Group detail: members, auction history, subscriptions
    ChitGroupDetailClient.tsx
  new/
    page.tsx
    ChitGroupForm.tsx           ← Name, chit value, members, start date, commission %
  actions.ts
```

---

### 3.3 — `actions.ts` Key Functions

```ts
export async function createChitGroup(formData: FormData) {
  // Creates ChitGroup
  // Generates ChitSubscription rows for all members × all periods
  // Generates ChitAuction stubs for all periods
}

export async function recordAuctionWinner(
  auctionId: string,
  winnerMemberId: string,
  prizeAmount: number
) {
  // Calculates bidDiscount, commission, dividend
  // Updates ChitAuction: status='completed', winnerMemberId, amounts
  // Marks winnerMember.hasWon = true
  // Writes AuditLog
}

export async function recordChitPayment(
  memberId: string,
  periodNumber: number,
  paidAmount: number
) {
  // Updates ChitSubscription: paidAmount, status='paid', paidAt
  // Writes AuditLog
}
```

---

### 3.4 — Schedule Generation Logic

When a `ChitGroup` is created, generate subscriptions for all members × all periods:

```ts
const members = []; // after creating N ChitMember records

for (let period = 1; period <= totalMembers; period++) {
  const dueDate = new Date(startDate);
  dueDate.setMonth(dueDate.getMonth() + period - 1);

  for (const member of members) {
    await prisma.chitSubscription.create({
      data: {
        memberId: member.id,
        periodNumber: period,
        dueDate,
        dueAmount: monthlyContrib,
        status: 'upcoming',
      },
    });
  }
}
```

---

### 3.5 — Acceptance Criteria
- [ ] Admin can create a chit group with N members linked to existing customers
- [ ] Subscriptions automatically generated for all members × all periods on creation
- [ ] Admin can record auction winner for a period; dividend calculated and stored
- [ ] Admin can mark individual member payments period by period
- [ ] Dashboard shows active chit group count when appType is chitfunds
- [ ] A member cannot win twice in the same group

---

## Phase 4 — File Uploads (Production)

### Problem
Currently all file uploads (KYC documents, security cheques, profile photos, RC documents, guarantor photos) only save the **filename** as a string. No actual file is stored anywhere. This needs a real storage backend before going to production.

### Recommended Approach — Vercel Blob (or AWS S3)

This guide uses **Vercel Blob** (simplest for a Vercel-hosted Next.js app). For AWS S3, the API calls differ but the structure is identical.

---

### 4.1 — Install Dependency

```bash
npm install @vercel/blob
```

---

### 4.2 — Create Upload API Route

Create **`app/api/upload/route.ts`**:

```ts
import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 5 MB limit' }, { status: 400 });
  }

  // Folder scoped by tenantId to prevent cross-tenant access
  const tenantId = (session.user as any).tenantId;
  const filename = `${tenantId}/${Date.now()}-${file.name.replace(/\s/g, '_')}`;

  const blob = await put(filename, file, {
    access: 'private',  // Use 'public' if you want direct URL access
  });

  return NextResponse.json({ url: blob.url, pathname: blob.pathname });
}
```

---

### 4.3 — Update Customer Form Upload Logic

Replace the filename-only approach in `CustomerForm.tsx` and `customers/actions.ts`:

**In the form (client component):**

```ts
async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data.url;  // Store the full URL, not just filename
}
```

**In `customers/actions.ts`**, replace:
```ts
const profilePhoto = profilePhotoFile?.name ?? null;
```
With (the URL comes from the client after calling `/api/upload`):
```ts
const profilePhoto = formData.get('profilePhotoUrl') as string | null;
```

---

### 4.4 — Environment Variable

Add to `.env.local` and Vercel environment:

```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

Get this from Vercel Dashboard → Storage → Blob → your store → `.env.local` button.

---

### 4.5 — Serving Files Securely

For `access: 'private'` blobs, generate a signed URL on the server before rendering:

```ts
import { head } from '@vercel/blob';

// In a server component or API route:
const blobInfo = await head(storedUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
// blobInfo.downloadUrl has a short-lived signed URL
```

---

### 4.6 — Acceptance Criteria
- [ ] KYC documents upload and the URL is stored in the database
- [ ] Profile photo uploads and renders in the customer profile
- [ ] Security cheque images stored (if scanned)
- [ ] Guarantor photos stored
- [ ] Files are scoped per tenant (cross-tenant access blocked)
- [ ] Files over 5 MB rejected with a clear error
- [ ] Non-image/PDF file types rejected

---

## Phase 5 — Subscription Billing & Tenant Self-Service

> **Timeline:** After Phase 2–4 are complete and the product has paying customers.

### Overview
Each tenant should have a subscription plan that gates the number of active loans, agents, and app modules they can use. Billing via Razorpay (India) or Stripe (international).

### Key Schema Additions

```prisma
model TenantSubscription {
  id              String    @id @default(cuid())
  tenantId        String    @unique @map("tenant_id")
  plan            String    @default("trial")  // trial | basic | pro | enterprise
  status          String    @default("active") // active | expired | cancelled
  maxActiveLoans  Int       @default(50)
  maxAgents       Int       @default(3)
  enabledModules  String[]  @map("enabled_modules") // ["microlending", "autofinance"]
  trialEndsAt     DateTime? @map("trial_ends_at")
  currentPeriodEnd DateTime? @map("current_period_end")
  razorpaySubId   String?   @map("razorpay_sub_id")
  createdAt       DateTime  @default(now()) @map("created_at")

  tenant          Tenant    @relation(fields: [tenantId], references: [id])
  @@map("tenant_subscriptions")
}
```

### Key Routes to Add

```
app/admin/billing/
  page.tsx              ← Developer view of all tenant subscriptions
  [tenantId]/page.tsx   ← Adjust plan, limits, enabled modules

app/portal/billing/
  page.tsx              ← Tenant self-service: view plan, upgrade CTA
```

### Guard Hook Pattern

Create **`lib/subscription.ts`**:

```ts
export async function checkLimit(tenantId: string, resource: 'loans' | 'agents') {
  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  if (!sub || sub.status !== 'active') throw new Error('Subscription inactive');

  if (resource === 'loans') {
    const count = await prisma.loan.count({ where: { tenantId, status: 'active' } });
    if (count >= sub.maxActiveLoans) {
      throw new Error(`Active loan limit reached (${sub.maxActiveLoans})`);
    }
  }

  if (resource === 'agents') {
    const count = await prisma.user.count({ where: { tenantId, role: 'agent', status: 'active' } });
    if (count >= sub.maxAgents) {
      throw new Error(`Agent limit reached (${sub.maxAgents})`);
    }
  }
}
```

Call `checkLimit(tenantId, 'loans')` inside `createLoan` action before creating the loan.

---

## Phase 6 — Data Export (CSV / PDF)

### Overview
Admins need to export collection reports, loan registers, and defaulter lists for offline use or regulatory compliance.

### Files to Create

```
app/api/export/
  collections/route.ts     ← GET with date range, returns CSV
  loans/route.ts           ← GET with status filter, returns CSV
  defaulters/route.ts      ← GET, returns CSV of overdue loans + penalty total
```

### CSV Export Pattern

```ts
// app/api/export/collections/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || role === 'agent') {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const from = new Date(searchParams.get('from') || new Date().toISOString().slice(0, 10));
  const to = new Date(searchParams.get('to') || new Date().toISOString().slice(0, 10));
  to.setHours(23, 59, 59, 999);

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();

  const entries = await prisma.collectionEntry.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      dailyCollection: { tenantId, appType },
    },
    include: {
      customer: { select: { name: true, customerCode: true } },
      loan: { select: { loanCode: true } },
      agent: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const header = 'Date,Customer Code,Customer Name,Loan Code,Agent,Due Amount,Received,Payment Mode\n';
  const rows = entries.map((e) =>
    [
      e.createdAt.toISOString().slice(0, 10),
      e.customer.customerCode,
      `"${e.customer.name}"`,
      e.loan.loanCode,
      `"${e.agent?.name ?? ''}"`,
      e.dueAmount.toString(),
      e.receivedAmount.toString(),
      e.paymentMode,
    ].join(',')
  );

  const csv = header + rows.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="collections-${from.toISOString().slice(0, 10)}.csv"`,
    },
  });
}
```

### UI Integration

Add Export buttons to `ReportsClient.tsx`:

```tsx
<a
  href={`/api/export/collections?from=${fromDate}&to=${toDate}`}
  className="btn btn-secondary btn-sm"
  download
>
  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>download</span>
  Export CSV
</a>
```

### Acceptance Criteria
- [ ] Admin can download collection CSV for a date range
- [ ] Admin can download full loan register CSV
- [ ] Admin can download defaulter list with penalty totals
- [ ] Agent cannot access export endpoints (401 returned)
- [ ] CSV columns match the spec headers

---

## Implementation Order (Recommended)

| Order | Phase | Estimated Effort |
|---|---|---|
| 1 | GAP-001: middleware.ts | 1–2 hours |
| 2 | GAP-002: Admin audit logs | 1 hour |
| 3 | GAP-003: Cron trigger | 30 minutes |
| 4 | Phase 6: CSV Export | 2–3 hours |
| 5 | Phase 4: File Uploads | 4–6 hours |
| 6 | Phase 2: Auto Finance | 2–3 days |
| 7 | Phase 3: Chit Funds | 3–4 days |
| 8 | Phase 5: Subscription Billing | 1–2 weeks |
