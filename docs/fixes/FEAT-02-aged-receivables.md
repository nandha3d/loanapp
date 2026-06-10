# FEAT-02 — Customer Subledger + Aged Receivables Report

**Priority:** 🟡 MEDIUM  
**Category:** Feature — Accounting  
**Effort:** 3–4 hours

---

## Background

The premium accounting module has a general ledger (Account → JournalLine), trial balance, P&L, and balance sheet. What's missing is:

1. **Customer subledger** — per-customer view of all JEs that affect their receivable balance
2. **Aged receivables report** — outstanding amounts bucketed by aging: 0–30, 31–60, 61–90, 90–180, 180+ days
3. **Vendor subledger** — per-vendor outstanding payables (needed for expense vendors)

The aged receivables report is the most urgent — it's required for RBI NPA provisioning and internal credit risk management.

---

## Data Model

The data is already available:
- `Instalment.dueAmount - Instalment.receivedAmount` = outstanding per instalment
- `Instalment.dueDate` = used to compute aging buckets
- `Loan.customerId` = links to `Customer`

No new schema needed for basic aged receivables.

---

## Files to Create

- **Create:** `lib/accounting/agedReceivables.ts` — query + bucket logic
- **Create:** `app/api/v1/accounting/reports/aged-receivables/route.ts` — API endpoint
- **Add UI:** Link from accounting reports list page

---

## Step-by-Step Instructions for AI Agent

### Step 1 — Create `lib/accounting/agedReceivables.ts`

```typescript
import prisma from '@/lib/db';

export type AgedBucket = 'current' | '1_30' | '31_60' | '61_90' | '91_180' | 'over_180';

export interface AgedReceivableRow {
  customerId:  string;
  customerName: string;
  loanId:      string;
  loanCode:    string;
  dueDate:     Date;
  daysOverdue: number;
  outstanding: number;
  bucket:      AgedBucket;
}

function getBucket(daysOverdue: number): AgedBucket {
  if (daysOverdue <= 0)   return 'current';
  if (daysOverdue <= 30)  return '1_30';
  if (daysOverdue <= 60)  return '31_60';
  if (daysOverdue <= 90)  return '61_90';
  if (daysOverdue <= 180) return '91_180';
  return 'over_180';
}

export async function getAgedReceivables(params: {
  tenantId:  string;
  asOfDate?: Date;
  branchId?: string;
}): Promise<{
  rows:    AgedReceivableRow[];
  summary: Record<AgedBucket, { count: number; amount: number }>;
}> {
  const asOf = params.asOfDate ?? new Date();

  const instalments = await prisma.instalment.findMany({
    where: {
      loan: {
        tenantId: params.tenantId,
        status:   'active',
        ...(params.branchId ? { branchId: params.branchId } : {}),
      },
      dueDate: { lte: asOf },
      status:  { in: ['upcoming', 'partial', 'overdue'] },
    },
    include: {
      loan: {
        include: {
          customer: { select: { id: true, name: true } },
        },
      },
    },
  });

  const rows: AgedReceivableRow[] = [];

  for (const inst of instalments) {
    const outstanding = Number(inst.dueAmount) - Number(inst.receivedAmount);
    if (outstanding <= 0.01) continue; // fully paid

    const daysOverdue = Math.floor(
      (asOf.getTime() - inst.dueDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    rows.push({
      customerId:   inst.loan.customer.id,
      customerName: inst.loan.customer.name,
      loanId:       inst.loan.id,
      loanCode:     inst.loan.loanCode ?? inst.loan.id,
      dueDate:      inst.dueDate,
      daysOverdue:  Math.max(0, daysOverdue),
      outstanding,
      bucket:       getBucket(daysOverdue),
    });
  }

  const emptyBucket = () => ({ count: 0, amount: 0 });
  const summary: Record<AgedBucket, { count: number; amount: number }> = {
    current:  emptyBucket(),
    '1_30':   emptyBucket(),
    '31_60':  emptyBucket(),
    '61_90':  emptyBucket(),
    '91_180': emptyBucket(),
    over_180: emptyBucket(),
  };

  for (const row of rows) {
    summary[row.bucket].count  += 1;
    summary[row.bucket].amount += row.outstanding;
  }

  return { rows, summary };
}
```

### Step 2 — Create API route

Create `app/api/v1/accounting/reports/aged-receivables/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, fail } from '@/lib/api/v1-envelope';
import { getAgedReceivables } from '@/lib/accounting/agedReceivables';
import { isPremiumAccountingEnabled } from '@/lib/accounting/premium';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) return fail('Unauthorized', 401);
  const tenantId = session.user.tenantId as string;

  if (!(await isPremiumAccountingEnabled(tenantId))) {
    return fail('Premium accounting required', 403);
  }

  const { searchParams } = new URL(req.url);
  const asOfDate = searchParams.get('asOf')
    ? new Date(searchParams.get('asOf')!)
    : new Date();
  const branchId = searchParams.get('branchId') ?? undefined;

  const result = await getAgedReceivables({ tenantId, asOfDate, branchId });
  return ok(result);
}
```

### Step 3 — Add CSV export option

In the same route, support `?format=csv`:

```typescript
if (searchParams.get('format') === 'csv') {
  const csv = [
    'Customer,Loan Code,Due Date,Days Overdue,Outstanding,Bucket',
    ...result.rows.map(r =>
      `"${r.customerName}","${r.loanCode}","${r.dueDate.toISOString().slice(0,10)}",` +
      `${r.daysOverdue},${r.outstanding.toFixed(2)},${r.bucket}`
    ),
  ].join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="aged-receivables-${asOfDate.toISOString().slice(0,10)}.csv"`,
    },
  });
}
```

### Step 4 — Add link in accounting reports UI

In `app/dashboard/accounting/reports/page.tsx` or the reports nav, add:

```tsx
<Link href="/dashboard/accounting/reports/aged-receivables">
  Aged Receivables
</Link>
```

Create the page at `app/dashboard/accounting/reports/aged-receivables/page.tsx` showing the summary table with bucket totals and a drilldown to per-customer rows.

---

## Verification

1. `GET /api/v1/accounting/reports/aged-receivables` → returns `{ rows, summary }` with correct buckets
2. `GET /api/v1/accounting/reports/aged-receivables?format=csv` → downloads CSV
3. Fully paid instalments do NOT appear in the report
4. `npx tsc --noEmit` → 0 errors
