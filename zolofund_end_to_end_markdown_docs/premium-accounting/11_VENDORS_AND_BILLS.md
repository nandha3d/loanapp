# 11 · Vendors & Bills

> Accounts Payable. Vendor master + bill capture + payment + TDS auto-deduction.

---

## 1. Purpose

- Maintain a vendor master (name, GSTIN, PAN, address, default ledger, payment terms).
- Capture bills against vendors with line items, GST, and optional TDS.
- Record payments (full or partial) and produce automatic journal entries.
- Show ageing of open bills and "Bills due ≤ 7 days" on Dashboard.

---

## 2. Route & access

| | |
|---|---|
| **Route** | `/<module>/accounting/premium/vendors` |
| **Tabs** | `vendors` (default) · `bills` · `payments` |
| **Sub-routes** | `/vendors/[id]`, `/vendors/[id]/bills/new`, `/vendors/bills/[billId]` |
| **Files** | `app/(dashboard)/[module]/accounting/premium/vendors/*` |
| **Actions** | `app/(dashboard)/[module]/accounting/premium/vendors/actions.ts` |
| **Role gate (read)** | `admin` / `superadmin` / `developer` |
| **Role gate (write)** | `admin` (subject to approval cap on bills) / `superadmin` / `developer` |
| **Subscription gate** | `premiumAccountingEnabled` |

---

## 3. Data model

```prisma
model Vendor {
  id            String   @id @default(cuid())
  tenantId      String   @map("tenant_id")
  branchId      String?  @map("branch_id")
  name          String
  vendorCode    String   @map("vendor_code")
  gstin         String?
  pan           String?
  email         String?
  phone         String?
  address       String?  @db.Text
  state         String?                              // 'KA', 'TN' etc. for inter-state detection
  paymentTermsDays Int   @default(30) @map("payment_terms_days")
  defaultExpenseAccountId String? @map("default_expense_account_id")
  tdsSection    String?  @map("tds_section")         // '194I' default for landlords
  status        String   @default("active")
  notes         String?  @db.Text
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  deletedAt     DateTime? @map("deleted_at")

  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  branch        Branch?  @relation(fields: [branchId], references: [id])
  defaultExpenseAccount Account? @relation(fields: [defaultExpenseAccountId], references: [id])
  bills         Bill[]
  tdsDeductions TdsDeduction[]

  @@unique([tenantId, vendorCode])
  @@index([tenantId, status])
  @@index([gstin])
  @@map("vendors")
}

model Bill {
  id            String   @id @default(cuid())
  tenantId      String   @map("tenant_id")
  branchId      String?  @map("branch_id")
  vendorId      String   @map("vendor_id")
  billNo        String   @map("bill_no")                // vendor's invoice number
  billDate      DateTime @map("bill_date") @db.Date
  dueDate       DateTime @map("due_date") @db.Date
  subTotal      Decimal  @map("sub_total") @db.Decimal(18, 2)
  taxAmount     Decimal  @default(0) @map("tax_amount") @db.Decimal(18, 2)
  total         Decimal  @db.Decimal(18, 2)
  paidAmount    Decimal  @default(0) @map("paid_amount") @db.Decimal(18, 2)
  tdsAmount     Decimal  @default(0) @map("tds_amount") @db.Decimal(18, 2)
  netPayable    Decimal  @map("net_payable") @db.Decimal(18, 2)
  status        String   @default("unpaid")              // 'draft' | 'unpaid' | 'partial' | 'paid' | 'cancelled' | 'pending_approval'
  notes         String?  @db.Text
  postedJEId    String?  @map("posted_je_id")
  paidJEIds     String   @default("[]") @map("paid_je_ids") @db.LongText  // JSON array
  attachmentPath String? @map("attachment_path")        // optional PDF/JPEG of original bill
  createdById   String   @map("created_by_id")
  approvedById  String?  @map("approved_by_id")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  deletedAt     DateTime? @map("deleted_at")

  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  branch        Branch?  @relation(fields: [branchId], references: [id])
  vendor        Vendor   @relation(fields: [vendorId], references: [id])
  createdBy     User     @relation("BillCreator", fields: [createdById], references: [id])
  approvedBy    User?    @relation("BillApprover", fields: [approvedById], references: [id])
  lines         BillLine[]
  tdsDeductions TdsDeduction[]

  @@unique([tenantId, vendorId, billNo])
  @@index([tenantId, status, dueDate])
  @@index([vendorId, billDate])
  @@map("bills")
}

model BillLine {
  id              String   @id @default(cuid())
  billId          String   @map("bill_id")
  expenseAccountId String  @map("expense_account_id")
  description     String   @db.Text
  hsnSac          String?  @map("hsn_sac")
  quantity        Decimal  @default(1) @db.Decimal(18, 4)
  unitPrice       Decimal  @map("unit_price") @db.Decimal(18, 2)
  amount          Decimal  @db.Decimal(18, 2)
  taxCode         String?  @map("tax_code")             // 'GST_18' etc.
  taxAmount       Decimal  @default(0) @map("tax_amount") @db.Decimal(18, 2)
  total           Decimal  @db.Decimal(18, 2)
  lineNo          Int      @default(0) @map("line_no")

  bill            Bill     @relation(fields: [billId], references: [id], onDelete: Cascade)
  expenseAccount  Account  @relation(fields: [expenseAccountId], references: [id])
  @@index([billId, lineNo])
  @@map("bill_lines")
}
```

---

## 4. UI — Vendors tab

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Premium > Vendors                                  [+ New Vendor]        │
├──────────────────────────────────────────────────────────────────────────┤
│ Filter: [status ▾] [search…]                                             │
│                                                                          │
│ Code      Name             GSTIN              State   Open AP   Last Bill│
│ ──────── ──────────────── ──────────────────  ─────  ────────  ────────── │
│ V-001    ABC Consulting   29ABCDE1234F1Z1     KA     12,000    21-May-26 │
│ V-002    XYZ Office Lease 33XYZAB5678H1Z3     TN     30,000    01-May-26 │
│ V-003    John Auditor     —                   KA       0       12-Apr-26 │
└──────────────────────────────────────────────────────────────────────────┘
```

Row click → vendor detail (master fields, list of bills + payments + TDS deductions). Side actions: Edit, Deactivate, View ledger.

### Vendor master form (modal)

- Name (required)
- Code (auto-suggested `V-NNN`, editable)
- GSTIN (optional, validated by regex)
- PAN (optional, validated by regex)
- Email, Phone
- Address (multiline)
- State (dropdown of Indian states, drives intra/inter-state GST)
- Payment terms (days)
- Default expense account (CoA dropdown, expense class)
- Default TDS section (dropdown of configured TDS codes; "None" allowed)
- Notes

---

## 5. UI — Bills tab

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Premium > Bills                                       [+ New Bill]       │
├──────────────────────────────────────────────────────────────────────────┤
│ Filter: [vendor ▾] [status ▾] [due range] [search…]                       │
│                                                                          │
│ Bill #     Vendor          Date       Due       Total    Paid   Status   │
│ ────────── ──────────────  ────────── ────────── ──────── ──────  ─────── │
│ INV-9001   ABC Consulting  21-May-26  20-Jun-26  12,000   0      unpaid  │
│ INV-9002   XYZ Lease       01-May-26  31-May-26  30,000   30K    paid    │
│ INV-9003   ABC Consulting  10-Apr-26  10-May-26  18,000   8K     partial │
└──────────────────────────────────────────────────────────────────────────┘
```

### New bill form

```
┌──────────────────────────────────────────────────────────────────────────┐
│ + New Bill                                                               │
│ Vendor: [V-001 ABC Consulting ▾]   Bill #: [INV-9001]                    │
│ Bill date: [21-May-26]              Due date: [20-Jun-26]                │
│                                                                          │
│ Lines:                                                                   │
│ Description           Account              Qty   Rate    Tax    Total    │
│ Consulting services   5500 Marketing       1     10000   GST18  11,800   │
│ Travel reimburse      5400 Travel & Conv   1       200   EXEMPT    200   │
│ + Add line                                                               │
│                                                                          │
│ Sub-total: 10,200    Tax: 1,800   Total: 12,000   TDS (194Q 0.1%): 12    │
│ Net payable: 11,988                                                      │
│                                                                          │
│ Attachment: [Upload PDF]                                                 │
│ Notes:                                                                   │
│                                                                          │
│ [Save as Draft]  [Submit for Approval]  [Post]                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Posting flow

When **Post** clicked:

1. Validate (vendor active, lines ≥ 1, accounts valid, taxable amount ≥ 0).
2. Compute taxes via `lib/accounting/tax.ts → applyTaxToBill(bill, vendor.state, tenant.state)`. Splits intra/inter-state GST.
3. Compute TDS via `lib/accounting/tds.ts → calcTdsForBill(vendor, bill, fyTotals)`.
4. Open transaction:
   - Create the bill record (`status='unpaid'`, `paidAmount=0`).
   - Create journal entry source `bill` linking back to the bill:
     ```
     Dr  Expense (each line)
     Dr  Input CGST  (intra)
     Dr  Input SGST  (intra)
     Dr  Input IGST  (inter)
     Cr  Vendor Payable (2110)        total
     ```
     - **Note:** TDS is NOT recorded at bill posting; only at payment (since TDS is on payment date per Indian rule for 194Q; rent 194I has different rule — see settings).
5. Update bill `postedJEId`.

### Pay bill flow

Bill detail page → `[Pay]` button → opens payment modal:

```
Amount to pay: [11,988]    Date: [today]
Pay from:      [1210 HDFC Current ▾]
TDS to deduct: [12 (194Q 0.1%) — auto]   [Override]
Reference:     [UTR / Cheque No]
Narration:     ...
[Pay]
```

On submit:

1. Create JE:
   ```
   Dr  2110 Vendor Payable      12,000
   Cr  2210 TDS Payable 194Q        12
   Cr  1210 HDFC Current        11,988
   ```
2. Insert `TdsDeduction` row.
3. Update bill: `paidAmount += 12000`, `tdsAmount += 12`, status → `partial` or `paid`.

Partial payments allowed (e.g., 50% now, 50% later). Each generates its own JE.

---

## 6. Ageing report

A `[Ageing]` button at the top opens a side panel:

```
Vendor          0–30d    31–60d   61–90d   > 90d    Total
ABC Consulting  12,000   8,000    0        0        20,000
XYZ Lease       0        0        0        0        0
─────────────────────────────────────────────────────────
Total           12,000   8,000    0        0        20,000
```

Buckets computed against `Bill.dueDate − today()` for unpaid + partial bills.

---

## 7. Server actions

```ts
// Vendor
export async function createVendor(input: VendorInput): Promise<ActionResult<Vendor>>;
export async function updateVendor(id: string, input: VendorInput): Promise<ActionResult>;
export async function deactivateVendor(id: string): Promise<ActionResult>;

// Bill
export async function createBill(input: BillInput): Promise<ActionResult<Bill>>;
export async function updateBill(id: string, input: BillInput): Promise<ActionResult>;
export async function postBill(id: string): Promise<ActionResult<{ journalEntryId: string }>>;
export async function cancelBill(id: string): Promise<ActionResult>;
export async function payBill(id: string, input: PayBillInput): Promise<ActionResult<{ paymentJEId: string }>>;
export async function uploadBillAttachment(id: string, file: File): Promise<ActionResult>;

// Reports
export async function getAgeingReport(branchId?: string | null): Promise<AgeingRow[]>;
```

---

## 8. Validations

| Rule | Error |
|---|---|
| Vendor name length 2–255 | `name_invalid` |
| Vendor GSTIN matches `^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$` if provided | `gstin_invalid` |
| Vendor PAN matches `^[A-Z]{5}\d{4}[A-Z]$` if provided | `pan_invalid` |
| Bill has ≥ 1 line | `bill_no_lines` |
| Bill total = Σ line totals + tax | `bill_total_mismatch` |
| Bill total > tenant `accountingSettings.billApprovalCap` ⇒ requires approval | enforced server-side |
| Bill no. unique per (tenant, vendor) | `bill_no_duplicate` |
| Pay amount ≤ `bill.netPayable − bill.paidAmount` | `overpayment` |
| Cannot delete vendor with bills | `vendor_in_use` |
| Bill date inside locked period | `period_locked` |

---

## 9. i18n (`pa.vendors`)

```ts
pa: {
  vendors: {
    tabsVendors: 'Vendors',
    tabsBills: 'Bills',
    tabsPayments: 'Payments',
    newVendor: '+ New Vendor',
    newBill: '+ New Bill',
    columns: {
      code: 'Code', name: 'Name', gstin: 'GSTIN', state: 'State', openAp: 'Open AP', lastBill: 'Last Bill',
      billNo: 'Bill #', vendor: 'Vendor', date: 'Date', due: 'Due', total: 'Total', paid: 'Paid', status: 'Status',
    },
    vendorForm: {
      name: 'Name', code: 'Vendor code', gstin: 'GSTIN', pan: 'PAN', state: 'State',
      paymentTerms: 'Payment terms (days)', defaultExpense: 'Default expense account',
      defaultTds: 'Default TDS section', notes: 'Notes',
    },
    billForm: {
      vendor: 'Vendor', billNo: 'Bill #', billDate: 'Bill date', dueDate: 'Due date',
      addLine: '+ Add line', description: 'Description', account: 'Account', qty: 'Qty',
      rate: 'Rate', tax: 'Tax', total: 'Total', subTotal: 'Sub-total', taxLabel: 'Tax',
      tdsLabel: 'TDS', netPayable: 'Net payable', attachment: 'Attachment', notes: 'Notes',
      saveDraft: 'Save as Draft', submitForApproval: 'Submit for Approval', post: 'Post',
    },
    payModal: {
      title: 'Pay Bill',
      amount: 'Amount to pay', date: 'Date', payFrom: 'Pay from', tds: 'TDS to deduct',
      override: 'Override', reference: 'Reference (UTR / Cheque)', narration: 'Narration', pay: 'Pay',
    },
    ageing: {
      title: 'Ageing report',
      bucket_0_30: '0–30 days', bucket_31_60: '31–60', bucket_61_90: '61–90', bucket_over_90: '> 90', total: 'Total',
    },
    status: {
      draft: 'Draft', unpaid: 'Unpaid', partial: 'Partial', paid: 'Paid', cancelled: 'Cancelled', pending_approval: 'Pending Approval',
    },
    errors: {
      vendor_in_use: 'Cannot delete — vendor has bills.',
      bill_no_lines: 'Bill must have at least one line.',
      bill_no_duplicate: 'Bill number already exists for this vendor.',
      overpayment: 'Payment exceeds outstanding amount.',
      period_locked: 'Bill date falls in a locked period.',
      gstin_invalid: 'GSTIN format is invalid.',
      pan_invalid: 'PAN format is invalid.',
    },
  },
}
```

---

## 10. Edge cases

| Case | Behaviour |
|---|---|
| Vendor without GSTIN supplying GST bill | Allowed (URD purchase); RCM (reverse charge) not auto-handled in v1; show warning |
| Inter-state vendor (state ≠ tenant.state) | Auto-IGST; intra-state vendors use CGST+SGST |
| TDS threshold not yet crossed | TDS = 0; show note "Threshold not reached" |
| Vendor's first bill of FY for high-rate section (194I) | TDS deducted from rupee 1 (no threshold for some sections; see settings) |
| Partial payment then full | Bill stays `partial` until 100% paid; status flips to `paid` only when paid+tds = total |
| Cancel a posted bill | Creates reversal JE; sets status `cancelled`; cannot un-cancel |
| Bill date in locked period | Post blocked; user advised to date bill in current open period |
| Vendor deactivated mid-flow | Existing bills payable; new bills cannot be created against vendor |
| Attachment > 5 MB | Reject |
| Bill amount exceeds approval cap | `status='pending_approval'`, enters approval queue (see 14) |

---

## 11. Test scenarios

| ID | Scenario | Expected |
|---|---|---|
| VEN-01 | Create vendor with valid GSTIN | Saved; appears in list |
| VEN-02 | Invalid GSTIN | `gstin_invalid` |
| BIL-01 | Post bill 10,000 + GST18 intra-state | JE has Dr Expense 10K + CGST 900 + SGST 900, Cr Payable 11,800 |
| BIL-02 | Post bill inter-state | Dr IGST 1,800 instead of CGST/SGST |
| BIL-03 | Pay full amount with TDS 194Q | JE Dr Payable 12K, Cr TDS 12, Cr Bank 11,988 |
| BIL-04 | Partial pay 5K of 12K | bill.status=partial |
| BIL-05 | Cancel posted bill | Reversal JE created; status=cancelled |
| BIL-06 | Overpay attempt | `overpayment` |
| BIL-07 | Bill in locked period | Post blocked |
| BIL-08 | Ageing report after 60 days | Bill moves into 31–60 bucket |
| BIL-09 | Bill above approval cap | `pending_approval`, in queue |
| BIL-10 | Upload PDF attachment | Stored under `storage/accounting/bills/<id>` |

---

## 12. Acceptance criteria

1. Bill posting auto-generates a balanced JE.
2. Bill payments correctly deduct TDS based on configured section/threshold.
3. Ageing buckets are 0–30, 31–60, 61–90, > 90 days from due date.
4. Vendor deletion blocked when bills exist (soft deactivate only).
5. Branch scope respected.
6. Approval cap enforced server-side.
7. Audit log on every post, pay, cancel, attachment upload.
