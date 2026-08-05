# FEAT-01 — Tally XML Sync

**Priority:** 🟠 HIGH  
**Category:** Feature — Accounting Integration  
**Effort:** 4–6 hours

---

## Background

Tally ERP (TallyPrime) is the dominant accounting software in India. ZoloFund's premium accounting module stores journal entries in its own GL, but most accountants need data in Tally. The sync exports JournalEntry + JournalLine records as Tally XML that can be imported via the Tally XML import gateway.

Tally XML format:
```xml
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Journal" ACTION="Create">
            <DATE>20260610</DATE>
            <NARRATION>Loan L001 disbursed</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Loan Principal Receivable</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-50000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Cash on Hand</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>50000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
```

---

## Schema Change Required

Add `voucherType` to `JournalEntry` model in `prisma/schema.prisma`:

```prisma
model JournalEntry {
  // ... existing fields ...
  voucherType String? @map("voucher_type") // Tally voucher type: Journal, Receipt, Payment, Contra
}
```

Run `npx prisma db push` after adding.

---

## Files to Create / Modify

- **Create:** `lib/accounting/tallyExport.ts` — XML generator
- **Create:** `app/api/v1/accounting/export/tally/route.ts` — export endpoint
- **Modify:** `prisma/schema.prisma` — add `voucherType`
- **Modify:** `lib/accounting/autoPost.ts` — set `voucherType` on auto-posted entries

---

## Step-by-Step Instructions for AI Agent

### Step 1 — Add `voucherType` to schema

In `prisma/schema.prisma`, add to `JournalEntry`:

```prisma
voucherType String? @default("Journal") @map("voucher_type")
```

Run `npx prisma db push`.

### Step 2 — Update `autoPost.ts` to set `voucherType`

In each `autoPost*` function, add `voucherType` to the `prisma.journalEntry.create` data:

| Source Type | Tally Voucher Type |
|---|---|
| `loan_disburse` | `Payment` (cash out to borrower) |
| `loan_collection` | `Receipt` (cash in from borrower) |
| `bank_transfer` | `Contra` |
| `expense` | `Payment` |
| `manual` | `Journal` |

```typescript
await prisma.journalEntry.create({
  data: {
    // ...existing fields...
    voucherType: 'Payment',  // for loan_disburse
  },
});
```

### Step 3 — Create `lib/accounting/tallyExport.ts`

```typescript
import prisma from '@/lib/db';
import { isPremiumAccountingEnabled } from './premium';

function formatTallyDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function generateTallyXml(params: {
  tenantId:  string;
  fromDate:  Date;
  toDate:    Date;
  status?:   string; // 'posted' | 'draft' | undefined (all)
}): Promise<string> {
  const entries = await prisma.journalEntry.findMany({
    where: {
      tenantId:  params.tenantId,
      entryDate: { gte: params.fromDate, lte: params.toDate },
      status:    params.status ?? 'posted',
    },
    include: {
      lines: { include: { account: { select: { name: true, code: true } } } },
    },
    orderBy: { entryDate: 'asc' },
  });

  const vouchers = entries.map((je) => {
    const vchType = escapeXml(je.voucherType ?? 'Journal');
    const lines   = je.lines.map((line) => {
      const amount    = Number(line.debit) > 0 ? Number(line.debit) : Number(line.credit);
      const isDebit   = Number(line.debit) > 0;
      const ledger    = escapeXml(line.account.name);
      // In Tally: debit entry = ISDEEMEDPOSITIVE=Yes, amount negative; credit = No, amount positive
      const isDeemed  = isDebit ? 'Yes' : 'No';
      const tallyAmt  = isDebit ? -amount : amount;
      return `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${ledger}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>${isDeemed}</ISDEEMEDPOSITIVE>
          <AMOUNT>${tallyAmt.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`;
    }).join('');

    return `
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="${vchType}" ACTION="Create">
          <DATE>${formatTallyDate(je.entryDate)}</DATE>
          <NARRATION>${escapeXml(je.narration ?? '')}</NARRATION>
          <VOUCHERNUMBER>${escapeXml(je.entryNo ?? '')}</VOUCHERNUMBER>
          ${lines}
        </VOUCHER>
      </TALLYMESSAGE>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>##SVCurrentCompany</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${vouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}
```

### Step 4 — Create export route

Create `app/api/v1/accounting/export/tally/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateTallyXml } from '@/lib/accounting/tallyExport';
import { fail } from '@/lib/api/v1-envelope';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) return fail('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const from   = new Date(searchParams.get('from') ?? new Date().toISOString().slice(0, 7) + '-01');
  const to     = new Date(searchParams.get('to')   ?? new Date().toISOString().slice(0, 10));
  const status = searchParams.get('status') ?? 'posted';

  const xml = await generateTallyXml({
    tenantId: session.user.tenantId as string,
    fromDate: from,
    toDate:   to,
    status,
  });

  const filename = `tally-export-${from.toISOString().slice(0,10)}-to-${to.toISOString().slice(0,10)}.xml`;
  return new NextResponse(xml, {
    headers: {
      'Content-Type':        'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
```

### Step 5 — Add "Export to Tally" button in Accounting UI

In the accounting journal list page (`app/dashboard/accounting/journal/page.tsx` or similar), add a button:

```tsx
<a
  href={`/api/v1/accounting/export/tally?from=${fromDate}&to=${toDate}`}
  className="btn btn-outline"
  download
>
  Export to Tally XML
</a>
```

---

## Verification

1. `GET /api/v1/accounting/export/tally?from=2026-04-01&to=2026-06-30` → downloads valid XML
2. Import the XML into TallyPrime test environment → no import errors
3. Vouchers appear in Tally with correct dates, narrations, and amounts
4. `npx tsc --noEmit` → 0 errors
