# 08 · Tax, GST & TDS

> Indian tax compliance: GSTR-1 / GSTR-3B summaries + TDS register + downloadable JSON for filing portals.

---

## 1. Purpose

- Compute monthly GST liability (Output − Input).
- Generate GSTR-1 (outward supplies) and GSTR-3B (summary return) reports.
- Track TDS deducted on bills (Section 194A on interest paid, 194Q on goods, etc.) and produce TDS register + Form 26Q stub.
- Surface tax-payable balances on Dashboard and Balance Sheet correctly.

> **Scope reminder.** This is reporting + register tracking, not e-filing. The Premium module produces JSON/Excel files compliant with the GSTN offline utility; the user files them via the GSTN portal manually.

---

## 2. Route & access

| | |
|---|---|
| **Route** | `/<module>/accounting/premium/tax` |
| **Tabs** | `gstr3b` (default) · `gstr1` · `tds` · `payments` |
| **File** | `app/(dashboard)/[module]/accounting/premium/tax/page.tsx` |
| **Client** | `app/(dashboard)/[module]/accounting/premium/tax/TaxClient.tsx` |
| **Actions** | `app/(dashboard)/[module]/accounting/premium/tax/actions.ts` |
| **Role gate** | `admin` / `superadmin` / `developer` |
| **Subscription gate** | `premiumAccountingEnabled` |

---

## 3. Configuration prerequisites

Tenant Settings (see 14) must define:

- **GSTIN** of the tenant (15-char alphanumeric)
- **State** (drives intra-state CGST+SGST vs inter-state IGST split)
- **GST scheme** — regular / composition / exempt
- **Tax codes** — at minimum `GST_18`, `GST_12`, `GST_5`, `EXEMPT`, plus TDS codes `TDS_194A_10`, `TDS_194Q_0.1`, `TDS_194C_1` (configurable)

If GSTIN is missing, the tax page shows a setup wizard.

---

## 4. Data model

### 4.1 `tax_codes`

```prisma
model TaxCode {
  id          String  @id @default(cuid())
  tenantId    String  @map("tenant_id")
  code        String                              // 'GST_18'
  label       String                              // 'GST 18%'
  category    String                              // 'gst_output' | 'gst_input' | 'tds_section'
  ratePct     Decimal @db.Decimal(6, 3)           // 18.000
  cgstPct     Decimal? @db.Decimal(6, 3)          // 9.000 (intra-state)
  sgstPct     Decimal? @db.Decimal(6, 3)
  igstPct     Decimal? @db.Decimal(6, 3)          // 18.000 (inter-state)
  tdsSection  String?  @map("tds_section")        // '194A'
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@unique([tenantId, code])
  @@map("tax_codes")
}
```

### 4.2 `tds_deductions`

```prisma
model TdsDeduction {
  id              String   @id @default(cuid())
  tenantId        String   @map("tenant_id")
  billId          String?  @map("bill_id")
  paymentId       String?  @map("payment_id")
  vendorId        String   @map("vendor_id")
  section         String                              // '194A' | '194Q' | '194C'
  ratePct         Decimal  @db.Decimal(6, 3)
  taxableAmount   Decimal  @db.Decimal(18, 2)
  tdsAmount       Decimal  @db.Decimal(18, 2)
  paymentDate     DateTime @db.Date
  certificateNo   String?  @map("certificate_no")     // future
  challanNo       String?  @map("challan_no")         // when remitted to govt
  challanDate     DateTime? @map("challan_date") @db.Date
  status          String   @default("deducted")       // 'deducted' | 'remitted' | 'certificate_issued'
  journalEntryId  String?  @map("journal_entry_id")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  vendor          Vendor   @relation(fields: [vendorId], references: [id])
  bill            Bill?    @relation(fields: [billId], references: [id])
  @@index([tenantId, paymentDate])
  @@index([vendorId, section])
  @@map("tds_deductions")
}
```

### 4.3 `gst_summaries`

```prisma
model GstSummary {
  id              String   @id @default(cuid())
  tenantId        String   @map("tenant_id")
  periodKey       String   @map("period_key")        // '2026-05'
  outputTaxable   Decimal  @default(0) @map("output_taxable") @db.Decimal(18, 2)
  outputCGST      Decimal  @default(0) @map("output_cgst") @db.Decimal(18, 2)
  outputSGST      Decimal  @default(0) @map("output_sgst") @db.Decimal(18, 2)
  outputIGST      Decimal  @default(0) @map("output_igst") @db.Decimal(18, 2)
  inputTaxable    Decimal  @default(0) @map("input_taxable") @db.Decimal(18, 2)
  inputCGST       Decimal  @default(0) @map("input_cgst") @db.Decimal(18, 2)
  inputSGST       Decimal  @default(0) @map("input_sgst") @db.Decimal(18, 2)
  inputIGST       Decimal  @default(0) @map("input_igst") @db.Decimal(18, 2)
  netCGST         Decimal  @default(0) @map("net_cgst") @db.Decimal(18, 2)
  netSGST         Decimal  @default(0) @map("net_sgst") @db.Decimal(18, 2)
  netIGST         Decimal  @default(0) @map("net_igst") @db.Decimal(18, 2)
  totalLiability  Decimal  @default(0) @map("total_liability") @db.Decimal(18, 2)
  status          String   @default("draft")          // 'draft' | 'filed'
  filedAt         DateTime? @map("filed_at")
  filedById       String?   @map("filed_by_id")
  acknowledgementNo String? @map("acknowledgement_no")
  recomputedAt    DateTime @default(now()) @map("recomputed_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  filedBy         User?    @relation(fields: [filedById], references: [id])
  @@unique([tenantId, periodKey])
  @@map("gst_summaries")
}
```

---

## 5. UI — GSTR-3B tab (default)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Premium > Tax > GSTR-3B                                                  │
│ Period: [May 2026 ▾]    Recompute  Mark as filed   [⇩ JSON]  [⇩ Excel]   │
├──────────────────────────────────────────────────────────────────────────┤
│ Outward Taxable Supplies (3.1)                                           │
│   3.1(a) Taxable supplies               Taxable: ₹  86,000               │
│          (other than zero-rated)        CGST   : ₹   7,740               │
│                                         SGST   : ₹   7,740               │
│                                         IGST   : ₹       0               │
│   3.1(c) Nil-rated/exempt               Taxable: ₹  14,000               │
│                                                                          │
│ Input Tax Credit (4)                                                     │
│   4(A)(5) All other ITC                 CGST/SGST/IGST: ₹ 4,050 / 4,050  │
│   4(B)(2) Ineligible ITC                ─                                │
│                                                                          │
│ Tax payable                                                              │
│   Net CGST                              ₹  3,690                         │
│   Net SGST                              ₹  3,690                         │
│   Net IGST                              ₹      0                         │
│   Total liability                       ₹  7,380                         │
│                                                                          │
│ [Mark as filed]                                                          │
│   Filed on: —                                                            │
│   Acknowledgement no: —                                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

Compute rules:

```
outputCGST = Σ JL.credit where account.code in OUTPUT_CGST_CODES and entryDate in period
outputSGST = Σ JL.credit where account.code in OUTPUT_SGST_CODES
outputIGST = Σ JL.credit where account.code in OUTPUT_IGST_CODES
inputCGST  = Σ JL.debit  where account.code in INPUT_CGST_CODES
inputSGST  = Σ JL.debit  where account.code in INPUT_SGST_CODES
inputIGST  = Σ JL.debit  where account.code in INPUT_IGST_CODES

netCGST    = max(0, outputCGST - inputCGST)
netSGST    = max(0, outputSGST - inputSGST)
netIGST    = max(0, outputIGST - inputIGST)
totalLiability = netCGST + netSGST + netIGST
```

(Output minus input; if input > output, the difference carries forward as ITC — surfaced as a "ITC carry-forward" badge.)

Codes used live in `lib/accounting/taxAccounts.ts` and are matched on the seed CoA codes 2310/2320/2330 and 1410/1420/1430 by default; overridable in settings.

### Mark as filed

Sets `status='filed'`, captures `filedAt`, `filedById`, prompts for `acknowledgementNo`. Files an audit entry. Once filed, the period is **strongly recommended** to be locked (see 12) — banner pops to suggest it.

### Recompute

Triggers a fresh aggregation from `journal_lines`. Useful if entries were posted/reversed after `recomputedAt`.

### JSON export

Produces a JSON file matching GSTN offline-utility schema v1.0 (top-level fields `gstin`, `ret_period`, `sup_details`, `inward_sup`, `itc_elg`, `tx_pmt`). Save to `storage/tax/gstr3b-<period>.json` and download.

---

## 6. UI — GSTR-1 tab

GSTR-1 is the outward-supplies return. For micro-lenders **most supplies are services to retail consumers**, going under `B2C(small)` aggregate or `B2C(large)` if invoice > ₹2,50,000. Interest income on loans is **exempt**, so it appears in **NIL/Exempt** section.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Premium > Tax > GSTR-1                                                   │
│ Period: [May 2026]   [⇩ JSON]  [⇩ Excel]                                 │
├──────────────────────────────────────────────────────────────────────────┤
│ 4. B2B (Registered)                                          ₹       0   │
│ 5. B2C Large (≥ 2.5L inter-state)                            ₹       0   │
│ 6. Exports / Deemed Exports                                  ₹       0   │
│ 7. B2C (Others)                                              ₹  86,000   │
│ 8. Nil-rated, Exempt, Non-GST                                ₹ 560,000   │
│    - Interest Income (exempt)              ₹ 560,000                     │
│ 9. CR/DR Notes                                               ₹       0   │
│ 11. Advances received                                        ₹       0   │
│ 12. HSN-wise Summary (auto)                                              │
│     - SAC 999791 (Processing fees)         86,000 taxable                │
│     - SAC 997111 (Interest income)        560,000 exempt                 │
└──────────────────────────────────────────────────────────────────────────┘
```

HSN/SAC codes are configurable per `Account` (`hsnSac` field, optional).

### JSON export

Matches GSTR-1 v3 offline tool schema. Includes `b2cs` array, `nil` block, `hsn_sum` block.

---

## 7. UI — TDS tab

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Premium > Tax > TDS                                                      │
│ Period: [Q1 FY26 ▾]   Section: [All ▾]   [⇩ Form 26Q]  [⇩ Excel]         │
├──────────────────────────────────────────────────────────────────────────┤
│ Vendor               PAN          Section   Taxable    TDS%   TDS Amt    │
│ ────────────────── ─────────── ─────────  ────────  ─────  ──────────    │
│ ABC Consulting     ABCPC1234A   194Q       100,000   0.1%       100      │
│ XYZ Office Lease   XYZPL5678Z   194I        60,000   10.0%    6,000      │
│ John Auditor       AGNPA9999K   194J        25,000   10.0%    2,500      │
│ ...                                                                      │
│ ─────────────────────────────────────────────────  ─────  ──────────     │
│ Total                                                          8,600     │
│                                                                          │
│ Challan tracker:                                                         │
│ ─ Q1 deducted: 8,600   remitted: 0   pending: 8,600                      │
│ [Record challan]                                                         │
└──────────────────────────────────────────────────────────────────────────┘
```

### Record challan

Modal:
- Challan No (CIN)
- Challan Date
- Amount remitted
- BSR code
- Bank
- Linked deductions (multi-select rows)

On save, updates each deduction's `challanNo`, `challanDate`, `status='remitted'`.

### Form 26Q export

Excel template matching Income Tax dept. format (vendor PAN, section, deductee details, challan details, certificate). For v1, generate `.xlsx`; e-filing of Form 26Q is out of scope.

---

## 8. UI — Payments tab

Shows historical tax payments (GST + TDS) — a simple list with link to the journal entry that recorded each payment. "Record GST Payment" button opens a modal that creates a JE:

```
Dr  2310 Output CGST       3,690
Dr  2320 Output SGST       3,690
Dr  2330 Output IGST           0
Cr  1210 HDFC Current     7,380
```

…and links it to `GstSummary.totalLiability` paid.

---

## 9. Auto-derivation rules

When a bill is posted (`vendors actions.ts → postBill`) with line `taxCode='GST_18'`:

```
Dr  Expense (line.amount)        e.g. 60,000
Dr  Input CGST 9%                 5,400
Dr  Input SGST 9%                 5,400
Cr  Vendor Payable                70,800
```

If vendor is inter-state (vendor.state != tenant.state), use IGST instead:

```
Dr  Input IGST 18%                10,800
```

Similarly, when a customer is charged a processing fee with GST (income side, less common for lenders):

```
Dr  Bank                          1,180
Cr  Processing Fees               1,000
Cr  Output CGST 9%                   90
Cr  Output SGST 9%                   90
```

These derivations are handled by `lib/accounting/tax.ts → applyTaxToLines()` invoked by the journal-posting flow.

### TDS

When a bill is paid and the section/threshold conditions are met:

```
Dr  Vendor Payable              60,000
Cr  TDS Payable u/s 194I         6,000
Cr  HDFC Current                54,000
```

TDS deduction row is also created with the bill/payment link and rate applied.

Thresholds:
- 194I rent > ₹2,40,000/yr → 10%
- 194Q goods purchases > ₹50L/yr → 0.1%
- 194A interest payments > ₹40,000/yr → 10%
- 194J professional > ₹30,000 → 10%
- 194C contractor > ₹30,000 single or ₹1L aggregate → 1% (individual) / 2% (company)

Threshold tracking is per `(tenantId, vendorId, section, fiscalYear)`; the first transaction crossing the threshold deducts on the cumulative excess. Implementation: `lib/accounting/tds.ts → calcTdsForBill(vendor, bill, fyTotals)`.

---

## 10. Server actions

```ts
// Recompute current period's GST summary
export async function recomputeGstSummary(periodKey: string): Promise<ActionResult<GstSummary>>;

// Mark as filed
export async function markGstFiled(periodKey: string, ackNo: string): Promise<ActionResult>;

// Export JSON
export async function exportGstr3bJson(periodKey: string): Promise<File>;
export async function exportGstr1Json(periodKey: string): Promise<File>;

// TDS
export async function recordChallan(challanInput: ChallanInput): Promise<ActionResult>;
export async function exportForm26Q(quarterKey: string): Promise<File>;
```

---

## 11. i18n (`pa.tax`)

```ts
pa: {
  tax: {
    title: 'Tax, GST & TDS',
    tabs: {
      gstr3b: 'GSTR-3B',
      gstr1: 'GSTR-1',
      tds: 'TDS',
      payments: 'Payments',
    },
    period: 'Period',
    recompute: 'Recompute',
    markFiled: 'Mark as filed',
    exportJson: 'Export JSON',
    exportExcel: 'Excel',
    notConfigured: 'GSTIN not configured. ',
    setupNow: 'Set up now',
    gstr3b: {
      sec3_1a: '3.1(a) Outward taxable supplies',
      sec3_1c: '3.1(c) Nil-rated / Exempt',
      sec4: 'Input Tax Credit',
      netCgst: 'Net CGST',
      netSgst: 'Net SGST',
      netIgst: 'Net IGST',
      totalLiability: 'Total liability',
      ackLabel: 'Acknowledgement no.',
      filedOn: 'Filed on',
      lockSuggest: 'Filed — consider locking this period.',
    },
    gstr1: {
      b2b: 'B2B (Registered)',
      b2cLarge: 'B2C Large (≥ 2.5L inter-state)',
      exports: 'Exports / Deemed exports',
      b2cs: 'B2C (Others)',
      nil: 'Nil-rated / Exempt / Non-GST',
      hsnSummary: 'HSN-wise Summary',
    },
    tds: {
      vendor: 'Vendor',
      pan: 'PAN',
      section: 'Section',
      taxable: 'Taxable',
      rate: 'TDS %',
      amount: 'TDS Amt',
      challanLabel: 'Challan',
      recordChallan: 'Record challan',
      form26Q: '⇩ Form 26Q',
      challanNo: 'Challan No (CIN)',
      challanDate: 'Challan Date',
      remitted: 'Remitted',
      pending: 'Pending',
    },
    challanModal: {
      title: 'Record TDS Challan',
      amount: 'Amount',
      bsr: 'BSR Code',
      bank: 'Bank',
      linkedDeductions: 'Linked deductions',
      save: 'Save',
    },
  },
}
```

---

## 12. Edge cases

| Case | Behaviour |
|---|---|
| Tenant has no GSTIN | All tabs gate behind setup wizard, no compute |
| Composition scheme | GSTR-3B replaced by CMP-08 (out of scope v1; show banner) |
| Inter-state bill | Auto-routes to IGST not CGST/SGST |
| Bill imported from past month | Recompute updates the prior GST summary, **but** if that period is locked → blocked, suggest reversal in current period |
| TDS retro-applied (vendor crossed threshold mid-month) | Adjustment JE created in the month of crossing |
| Negative net (input > output) | `netCGST = 0`, ITC carry-forward computed and shown as separate line |
| GST mark-filed after closing & locking period | Allowed (it's a metadata change, not a journal entry) |
| TDS deducted but bill reversed | Deduction row marked `void`, surfaced in audit log |

---

## 13. Test scenarios

| ID | Scenario | Expected |
|---|---|---|
| TAX-01 | Post bill ₹60,000 + GST 18 intra-state | JE has CGST 5,400 + SGST 5,400; GSTR-3B input updates |
| TAX-02 | Inter-state vendor (state mismatch) | IGST 10,800; no CGST/SGST |
| TAX-03 | Recompute GSTR-3B after new entry | Updated figures within 1 s |
| TAX-04 | Mark filed | `filedAt` set, banner suggests period lock |
| TAX-05 | TDS 194I rent ₹3,00,000/yr first crossing | Deducted 10% on excess only |
| TAX-06 | Record challan for 3 deductions | All 3 update to `remitted` |
| TAX-07 | Export 26Q | Excel matches dept template column names |
| TAX-08 | Export GSTR-3B JSON | Validates against GSTN schema v1.0 |
| TAX-09 | Composition tenant | Wizard blocks GSTR-3B |
| TAX-10 | Period locked, recompute clicked | Recompute allowed (read-only); mark-filed allowed |

---

## 14. Acceptance criteria

1. GSTR-3B totals reconcile to GST account balances on Trial Balance ± ₹1.
2. GSTR-1 B2C(s) + Nil + B2B sums equal the credit side of income accounts with GST output for the period.
3. TDS register Σ amount equals `2210 TDS Payable` credit movement for the period.
4. JSON exports validate against GSTN offline-utility schema.
5. Threshold logic prevents under-deduction; never over-deducts beyond statutory rates.
6. Challan recording moves deductions from `deducted` to `remitted`.
7. Audit log captures every recompute, mark-filed, challan record.
