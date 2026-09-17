# FEAT-05 — GST GSTR-1 / GSTR-3B Export Format

**Priority:** 🟡 MEDIUM  
**Category:** Feature — Compliance  
**Effort:** 4–6 hours

---

## Background

NBFCs and microfinance companies registered under GST must file:
- **GSTR-1** — outward supply (loan processing fees, late penalties, service charges)
- **GSTR-3B** — summary return with net tax liability

ZoloFund's accounting module records these as JournalEntries with GL accounts. The export format must match the GSTN portal's CSV upload format or the JSON API format for direct upload.

**Tax applicability in NBFC/MFI:**
- Processing fees: 18% GST (CGST 9% + SGST 9% for intra-state, or IGST 18% for inter-state)
- Interest income: **Exempt** from GST (RBI circular)
- Late payment charges: 18% GST
- Loan insurance premiums: 18% GST

---

## Schema Changes Required

1. Add GST registration fields to `Tenant` or `AppSetting`:
   - `gst_registration_number` (GSTIN — 15 chars)
   - `gst_trade_name`
   - `gst_state_code` (2-digit state code)

2. Add GST fields to `InvoiceTransaction` or create a `GstTransaction` model. Alternatively, add to `JournalEntry`:
   ```prisma
   gstRate      Float?  @map("gst_rate")      // 0, 5, 12, 18, 28
   cgst         Float?  @map("cgst")
   sgst         Float?  @map("sgst")
   igst         Float?  @map("igst")
   gstin        String? @map("gstin")         // buyer's GSTIN if B2B
   invoiceNo    String? @map("invoice_no")    // sequential invoice number
   supplyType   String? @map("supply_type")   // B2C, B2B, export
   ```

Run `npx prisma db push` after adding.

---

## Step-by-Step Instructions for AI Agent

### Step 1 — Add GST fields to schema

Add the `gstRate`, `cgst`, `sgst`, `igst`, `invoiceNo`, `supplyType` fields to `JournalEntry` in `prisma/schema.prisma`. These are optional — only populated for fee/penalty entries, not for interest (exempt) or operational entries.

### Step 2 — Create `lib/accounting/gstExport.ts`

```typescript
import prisma from '@/lib/db';
import { getSetting } from '@/lib/settings';

export async function generateGstr1Csv(params: {
  tenantId: string;
  month:    number; // 1-12
  year:     number;
}): Promise<string> {
  const fromDate = new Date(params.year, params.month - 1, 1);
  const toDate   = new Date(params.year, params.month, 0, 23, 59, 59); // last day of month

  const gstin     = (await getSetting(params.tenantId, 'gst_registration_number')) ?? '';
  const tradeName = (await getSetting(params.tenantId, 'gst_trade_name')) ?? '';

  // Fetch only entries with GST rate > 0 (taxable supplies)
  const entries = await prisma.journalEntry.findMany({
    where: {
      tenantId:  params.tenantId,
      entryDate: { gte: fromDate, lte: toDate },
      status:    'posted',
      gstRate:   { gt: 0 },
    },
    orderBy: { entryDate: 'asc' },
  });

  // GSTR-1 B2C large invoices CSV format (simplified)
  // Format: GSTIN of Supplier, Trade/Legal name, Invoice Number, Invoice Date,
  //         Invoice Value, Place Of Supply, Applicable % of Tax Rate, Invoice Type,
  //         Rate, Taxable Value, CGST, SGST, IGST
  const header = [
    'GSTIN of Supplier', 'Trade/Legal name', 'Invoice Number', 'Invoice Date',
    'Invoice Value', 'Place Of Supply', 'Tax Rate', 'Invoice Type',
    'Taxable Value', 'CGST', 'SGST', 'IGST'
  ].join(',');

  const rows = entries.map(e => {
    const taxableValue = (Number(e.cgst ?? 0) + Number(e.sgst ?? 0) + Number(e.igst ?? 0)) > 0
      ? (Number(e.cgst ?? 0) * 100 / 9).toFixed(2)  // back-calculate from 9% CGST
      : '0';
    return [
      gstin,
      `"${tradeName}"`,
      e.invoiceNo ?? '',
      e.entryDate.toISOString().slice(0, 10),
      (Number(e.cgst ?? 0) + Number(e.sgst ?? 0) + Number(e.igst ?? 0) + parseFloat(taxableValue)).toFixed(2),
      'Maharashtra',  // TODO: read from AppSetting.gst_state_code
      `${e.gstRate ?? 18}`,
      e.supplyType ?? 'B2C',
      taxableValue,
      (e.cgst ?? 0).toString(),
      (e.sgst ?? 0).toString(),
      (e.igst ?? 0).toString(),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}
```

### Step 3 — Create export route

Create `app/api/v1/accounting/export/gstr1/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateGstr1Csv } from '@/lib/accounting/gstExport';
import { fail } from '@/lib/api/v1-envelope';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) return fail('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1));
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()));

  const csv = await generateGstr1Csv({
    tenantId: session.user.tenantId as string,
    month,
    year,
  });

  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="GSTR1-${year}-${String(month).padStart(2,'0')}.csv"`,
    },
  });
}
```

### Step 4 — Accounting Settings: GST Setup

Add a "GST Settings" section to the accounting settings page:
- GSTIN (15-char alphanumeric)
- Trade/Legal Name
- State Code (dropdown of Indian states)
- "Generate GSTR-1" button (date range picker → download CSV)
- "Generate GSTR-3B" link (summary page — future)

---

## Verification

1. Set `gst_registration_number = "27AABCU9603R1ZX"` (test GSTIN)
2. Create a JE with `gstRate = 18`, `cgst = 900`, `sgst = 900` (₹10,000 fee)
3. `GET /api/v1/accounting/export/gstr1?month=6&year=2026` → downloads CSV with correct values
4. Import CSV into GST portal test environment — no format errors
5. `npx tsc --noEmit` → 0 errors
