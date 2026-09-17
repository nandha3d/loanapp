# 03 · Journal Entries

> Double-entry posting screen. The single source of truth from which every other report (P&L, Balance Sheet, Cash Flow, Trial Balance, GST) is derived.

---

## 1. Purpose

- Browse every journal entry posted to the books (manual + auto-generated from loans / collections / penalties / bills).
- Create manual journal entries (at minimum 2 lines, debits = credits, against accounts from CoA).
- Edit / reverse existing entries (subject to period lock + approval workflow).
- Drill from any other premium page (`accountId`, `loanId`, `customerId`, `date`) to the journal entries that produced the number.

---

## 2. Route & access

| | |
|---|---|
| **List route** | `/<module>/accounting/premium/journal` |
| **New route** | `/<module>/accounting/premium/journal/new` |
| **Detail route** | `/<module>/accounting/premium/journal/[id]` |
| **List file** | `app/(dashboard)/[module]/accounting/premium/journal/page.tsx` |
| **List client** | `app/(dashboard)/[module]/accounting/premium/journal/JournalListClient.tsx` |
| **New file** | `app/(dashboard)/[module]/accounting/premium/journal/new/page.tsx` |
| **Detail file** | `app/(dashboard)/[module]/accounting/premium/journal/[id]/page.tsx` |
| **Actions** | `app/(dashboard)/[module]/accounting/premium/journal/actions.ts` |
| **Role gate (read)** | `admin` / `superadmin` / `developer` |
| **Role gate (post)** | `admin` (subject to per-entry amount cap & approval) / `superadmin` / `developer` |
| **Subscription gate** | `premiumAccountingEnabled` |

---

## 3. Data model

### 3.1 `journal_entries`

```prisma
model JournalEntry {
  id            String        @id @default(cuid())
  tenantId      String        @map("tenant_id")
  branchId      String?       @map("branch_id")
  entryNo       String        @map("entry_no")          // 'JE-2026-0421' (per tenant per FY)
  entryDate     DateTime      @map("entry_date") @db.Date
  postingDate   DateTime      @default(now()) @map("posting_date")
  narration     String?       @db.Text
  status        String        @default("posted")
                                                       // 'draft' | 'pending_approval' | 'posted' | 'reversed'
  sourceType    String        @map("source_type")       // 'manual' | 'loan_disbursement' | 'collection' | 'penalty_accrual' | 'penalty_settlement' | 'bill' | 'bill_payment' | 'bank_reconciliation' | 'depreciation' | 'tax_payment' | 'period_close' | 'reversal'
  sourceId      String?       @map("source_id")         // FK back to Loan, CollectionEntry, Bill, etc.
  totalDebit    Decimal       @map("total_debit") @db.Decimal(18, 2)
  totalCredit   Decimal       @map("total_credit") @db.Decimal(18, 2)
  currency      String        @default("INR")
  reversedById  String?       @map("reversed_by_id")    // points to the reversing JE
  createdById   String        @map("created_by_id")
  approvedById  String?       @map("approved_by_id")
  approvedAt    DateTime?     @map("approved_at")
  periodLockId  String?       @map("period_lock_id")
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")

  tenant        Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  branch        Branch?       @relation(fields: [branchId], references: [id])
  createdBy     User          @relation("JECreator", fields: [createdById], references: [id])
  approvedBy    User?         @relation("JEApprover", fields: [approvedById], references: [id])
  lines         JournalLine[]
  reversedBy    JournalEntry? @relation("JEReversal", fields: [reversedById], references: [id])
  reversalOf    JournalEntry[]@relation("JEReversal")
  approvals     AccountingApproval[]

  @@unique([tenantId, entryNo])
  @@index([tenantId, entryDate])
  @@index([tenantId, status, entryDate])
  @@index([branchId, entryDate])
  @@index([sourceType, sourceId])
  @@map("journal_entries")
}
```

### 3.2 `journal_lines`

```prisma
model JournalLine {
  id              String       @id @default(cuid())
  entryId         String       @map("entry_id")
  accountId       String       @map("account_id")
  debit           Decimal      @default(0) @db.Decimal(18, 2)
  credit          Decimal      @default(0) @db.Decimal(18, 2)
  description     String?      @db.Text
  // Sub-ledger linkage (optional, for drill-down)
  loanId          String?      @map("loan_id")
  customerId      String?      @map("customer_id")
  vendorId        String?      @map("vendor_id")
  billId          String?      @map("bill_id")
  // Tax markers
  taxCode         String?      @map("tax_code")         // 'GST_18' | 'GST_12' | 'GST_5' | 'EXEMPT' | 'TDS_194A_10' | null
  taxableAmount   Decimal?     @map("taxable_amount") @db.Decimal(18, 2)
  // Order in the entry display
  lineNo          Int          @default(0) @map("line_no")

  entry           JournalEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  account         Account      @relation(fields: [accountId], references: [id])

  @@index([accountId])
  @@index([entryId, lineNo])
  @@index([loanId])
  @@index([customerId])
  @@index([vendorId])
  @@index([taxCode])
  @@map("journal_lines")
}
```

### 3.3 Migration (DDL)

See OVERVIEW §5 for the master migration. Both tables go into `prisma/migrations/<ts>_premium_accounting_phase1/migration.sql`.

---

## 4. UI — List page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Premium > Journal Entries                                  [+ New Entry]   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Filter: [date range] [account ▾] [source ▾] [status ▾] [search…]            │
│         [Reset]                                                             │
│                                                                             │
│ Entry #     Date        Narration           Source         Dr      Cr   ●   │
│ ─────────── ──────────  ─────────────────── ──────────── ─────── ─────── ── │
│ JE-2026-421 21 May 2026 Salary May          Manual       80,000  80,000  ✔  │
│ JE-2026-420 21 May 2026 Loan #L0014 disb.   Auto-loan    50,000  50,000  ✔  │
│ JE-2026-419 21 May 2026 Collection L0007    Auto-coll    1,200   1,200   ✔  │
│ JE-2026-418 20 May 2026 Rent May            Manual       60,000  60,000  ⏳ │
│ ...                                                                         │
│ [Prev]  Page 1 / 12  [Next]                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### List behaviour

- Default sort: `entryDate desc, entryNo desc`. Stable.
- Pagination: 50 rows per page, cursor pagination on `(entryDate, id)`.
- Search box matches against `narration`, `entryNo`, and `lines.description`.
- Status badge: `posted` (green) · `draft` (grey) · `pending_approval` (yellow) · `reversed` (red strike-through).
- Clicking a row opens detail.

### Filters

- **Date range** — defaults to current month.
- **Account** — searchable dropdown of CoA; filters `lines.accountId`.
- **Source** — multi-select: Manual, Loan disb, Collection, Penalty, Bill, Bank rec, Depreciation, Tax payment, Period close, Reversal.
- **Status** — multi-select.
- **Search** — text.

Filter state persists in URL query params.

### Export

Top-right `[⇩ Export]` button: CSV (current filter) · Tally XML · Excel. Streams from server action via `Response`.

---

## 5. UI — New entry page

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Premium > Journal Entries > New                                         │
├──────────────────────────────────────────────────────────────────────────┤
│  Entry date: [21 May 2026 ▾]    Narration: [Salary for May            ]  │
│  Branch:     [Main Branch ▾]    Reference: [optional ext. ref]           │
│                                                                          │
│  Lines:                                                                  │
│  #  Account                          Description       Debit    Credit   │
│  1  [5100 Salaries & Wages       ▾] [May salaries  ]  80,000     ─       │
│  2  [1210 HDFC Current Account   ▾] [Bank transfer]    ─       80,000    │
│  +  Add line                                                             │
│                                                                          │
│  Tax: [None ▾]   (only on income/expense lines)                          │
│                                                                          │
│  Totals:                                              80,000   80,000 ✔  │
│                                                                          │
│  [Save as Draft]            [Submit for Approval]    [Post] (if author)  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Behaviour

- Always renders at least **2 lines** by default.
- Each line: account dropdown (CoA, active only), description, debit, credit. Same line cannot have both Dr and Cr (one must be 0). Auto-tab from Dr → Cr after typing.
- Live totals at the bottom; "Balanced ✔" badge turns green only when `Σ debit === Σ credit > 0`.
- `+ Add line` appends an empty line. Min 2, max 50.
- Tax dropdown on line: when populated, **auto-splits the line** into base + GST output/input lines on submit (handled server-side by `applyTax(line)` in `lib/accounting/tax.ts`).
- **Submit logic**:
  - `[Save as Draft]` → `status='draft'`, no balance check (allows half-done entries).
  - `[Submit for Approval]` → `status='pending_approval'`, balance must equal, amount routed via approval rules (see 14).
  - `[Post]` → `status='posted'` directly. Only enabled if user passes the approval-cap test (`canPostDirectly(user, totalDebit)`).

### Drafts

Drafts auto-save every 10 s while the user is editing (server action `upsertDraftEntry`). A draft auto-expires after 7 days if not posted (cron `recompute-balances/route.ts` also vacuums old drafts).

---

## 6. UI — Detail page

Shows everything: header, all lines, audit trail (who created, who approved, when), reversal link if any. Top-right action menu:

- **Reverse entry** — creates a new JE with all debits & credits swapped, `sourceType='reversal'`, `reversedById` linkage on both rows. Allowed only when:
  - User has `superadmin` or `developer` role, **or**
  - Entry was created by current user within the last 24 h **and** period not locked
- **Edit lines** — only allowed when `status='draft'` or `pending_approval`.
- **Print** — server-rendered PDF voucher (react-pdf, `lib/accounting/pdfs/voucher.tsx`).
- **Download attachment** — see 6.1.

### 6.1 Attachments

Each entry may have ≤ 5 attachments (receipts, invoices). Stored on the same file storage as KYC documents (`storage/accounting/<entryId>/<filename>`). Max 5 MB each, types: pdf, jpg, png. Backed by `journal_entry_attachments` (small side-table — see schema appendix).

---

## 7. Server actions

`app/(dashboard)/[module]/accounting/premium/journal/actions.ts`:

```ts
'use server';

// Drafts
export async function upsertDraftEntry(input: DraftInput): Promise<ActionResult<{ id: string }>>;

// Submit / post
export async function submitForApproval(id: string): Promise<ActionResult>;
export async function postEntry(id: string): Promise<ActionResult>;
export async function rejectEntry(id: string, note: string): Promise<ActionResult>;

// Edit
export async function updateEntry(id: string, input: UpdateInput): Promise<ActionResult>;

// Reverse
export async function reverseEntry(id: string, reason: string): Promise<ActionResult<{ reversalId: string }>>;

// Attachments
export async function uploadAttachment(entryId: string, file: File): Promise<ActionResult>;
export async function deleteAttachment(entryId: string, attachmentId: string): Promise<ActionResult>;
```

### Posting logic (transactional)

```ts
await prisma.$transaction(async (tx) => {
  // 1. Re-fetch with lock
  const entry = await tx.journalEntry.findUnique({ where: { id }, include: { lines: true }});
  if (!entry || entry.status !== 'pending_approval' && entry.status !== 'draft') throw new Error('invalid_state');

  // 2. Balance check
  const dr = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
  const cr = entry.lines.reduce((s, l) => s + Number(l.credit), 0);
  if (Math.abs(dr - cr) > 0.01) throw new Error('not_balanced');
  if (dr === 0) throw new Error('empty_entry');

  // 3. Period lock check
  const period = await getPeriodForDate(tx, entry.tenantId, entry.entryDate);
  if (period?.status === 'locked') throw new Error('period_locked');

  // 4. Assign entry number (gapless per tenant per FY)
  if (!entry.entryNo) {
    entry.entryNo = await assignNextEntryNo(tx, entry.tenantId, entry.entryDate);
  }

  // 5. Approval rule
  const cap = await getUserApprovalCap(tx, userId);
  if (dr > cap) {
    return tx.journalEntry.update({ where: { id }, data: { status: 'pending_approval' }});
  }

  // 6. Post
  await tx.journalEntry.update({
    where: { id },
    data: {
      status: 'posted',
      totalDebit: dr,
      totalCredit: cr,
      approvedById: userId,
      approvedAt: new Date(),
    },
  });

  // 7. Bump account_balances incrementally
  for (const line of entry.lines) {
    await bumpAccountBalance(tx, line.accountId, entry.entryDate, line.debit, line.credit);
  }

  // 8. Audit log
  await tx.accountingAuditLog.create({ data: { ... } });
});
```

### Entry-number assignment

`assignNextEntryNo` uses a per-(tenantId, fy) sequence. Format: `JE-<FY>-<seq4>` e.g. `JE-2627-0421` for FY 2026-2027 entry #421. Sequence is **gapless** — drafts that never post still consume a number? **No** — number is assigned only at post time. Draft entries display `(unsaved)` until posted.

---

## 8. Auto-generated journal entries (system journals)

The premium module derives JEs from existing ZoloFund events. The derivation is done by a worker queue: every CollectionEntry / Loan create / Penalty insert fires a Prisma `$on('beforeExit')` middleware (or, simpler, an `after-insert` hook in the relevant server action) that calls `lib/accounting/postings.ts → enqueuePostingJob`. A background runner (Vercel cron every 1 min) processes the queue.

| Event | Source | Posting |
|---|---|---|
| Loan disbursed | `loans.actions.ts → createLoan` after commit | Dr `Loan Principal Receivable` 50000, Cr `Bank` 50000 |
| Collection (cash) | `collection/actions.ts → recordCollection` | Dr `Cash` 1200, Cr `Loan Principal Receivable` (principal part), Cr `Interest Income` (interest part) |
| Penalty accrual | `cron/accrue-penalties/route.ts` | Dr `Penalties Receivable`, Cr `Penalty Income` |
| Penalty settled | `penalty actions` | Dr `Cash/Bank`, Cr `Penalties Receivable` |
| Capital add (basic) | `accounting/actions.ts → addAccountEntry` type=capital_add | Dr `Bank`, Cr `Owner's Capital` |
| Expense (basic) | `accounting/actions.ts → addAccountEntry` type=expense | Dr `Expense:<category>`, Cr `Cash/Bank` (per the entry's category) |
| Bill posted | `vendors/actions.ts → postBill` | Dr `Expense:<bill.category>`, Dr `Input GST`, Cr `Bills Payable` |
| Bill paid | `vendors/actions.ts → payBill` | Dr `Bills Payable`, Cr `Bank` |
| TDS deduction on bill | `vendors/actions.ts → payBill` with TDS | Dr `Bills Payable`, Cr `TDS Payable`, Cr `Bank` |

Each derived JE has `sourceType` and `sourceId` so the queue can be re-run idempotently — duplicates are deduplicated on `(sourceType, sourceId)` unique key (see schema below).

```prisma
@@unique([sourceType, sourceId])
```

This unique index is added to `journal_entries`. Manual entries have `sourceType='manual'` and `sourceId=null`, so the unique constraint must be a partial unique (MySQL alternative: `(sourceType, sourceId)` unique with `sourceId NOT NULL` filtered via generated column). Implementation detail: use a generated stored column `dedup_key = IF(sourceId IS NULL, NULL, CONCAT(sourceType, ':', sourceId))` and unique on `dedup_key`.

---

## 9. Validation rules (manual entry)

| Rule | Error key |
|---|---|
| `lines.length >= 2` | `min_lines` |
| Each line has either Dr OR Cr (not both, not neither) | `line_side_invalid` |
| All Dr and Cr ≥ 0 | `negative_amount` |
| `Σ debit === Σ credit` | `not_balanced` |
| `Σ debit > 0` | `empty_entry` |
| `accountId` must be active and same tenant | `account_invalid` |
| Date is **not** in a locked period | `period_locked` |
| Date is not in future (config: allowFutureDated default false) | `future_dated` |
| User has approval cap ≥ total OR submits as draft / pending | `over_cap` |
| Tax code, if set, must be active and applicable to account class | `tax_invalid` |

Server-side validation lives in `lib/accounting/validateEntry.ts`. Client mirrors it for UX, but server is the source of truth.

---

## 10. i18n (`pa.journal`)

```ts
pa: {
  journal: {
    listTitle: 'Journal Entries',
    newTitle: 'New Journal Entry',
    new: '+ New Entry',
    columns: {
      entryNo: 'Entry #',
      date: 'Date',
      narration: 'Narration',
      source: 'Source',
      debit: 'Dr',
      credit: 'Cr',
      status: 'Status',
    },
    sources: {
      manual: 'Manual',
      loan_disbursement: 'Auto-loan',
      collection: 'Auto-collection',
      penalty_accrual: 'Auto-penalty',
      penalty_settlement: 'Auto-penalty settled',
      bill: 'Bill',
      bill_payment: 'Bill payment',
      bank_reconciliation: 'Bank rec',
      depreciation: 'Depreciation',
      tax_payment: 'Tax payment',
      period_close: 'Period close',
      reversal: 'Reversal',
    },
    status: {
      draft: 'Draft',
      pending_approval: 'Pending Approval',
      posted: 'Posted',
      reversed: 'Reversed',
    },
    actions: {
      reverse: 'Reverse',
      edit: 'Edit',
      print: 'Print',
      attach: 'Attach',
      saveDraft: 'Save as Draft',
      submitForApproval: 'Submit for Approval',
      post: 'Post',
      reject: 'Reject',
    },
    form: {
      entryDate: 'Entry date',
      narration: 'Narration',
      reference: 'Reference',
      branch: 'Branch',
      addLine: '+ Add line',
      account: 'Account',
      description: 'Description',
      debit: 'Debit',
      credit: 'Credit',
      tax: 'Tax',
      balanced: 'Balanced ✔',
      unbalanced: 'Unbalanced — debits {dr} ≠ credits {cr}',
    },
    errors: {
      min_lines: 'A journal entry needs at least 2 lines.',
      line_side_invalid: 'Each line must be either a debit OR a credit, not both.',
      negative_amount: 'Amounts cannot be negative.',
      not_balanced: 'Total debits must equal total credits.',
      empty_entry: 'Entry has no values.',
      account_invalid: 'Account is invalid or inactive.',
      period_locked: 'The date falls in a locked period.',
      future_dated: 'Future-dated entries are not allowed.',
      over_cap: 'Amount exceeds your approval cap — submit for approval instead.',
      tax_invalid: 'Tax code is not valid for this account.',
    },
    reverseConfirm: 'Reverse JE {entryNo}? A new offsetting entry will be created.',
    reverseReasonLabel: 'Reason for reversal',
  },
}
```

---

## 11. Edge cases

| Case | Behaviour |
|---|---|
| Posting at exactly midnight on the period boundary | Belongs to the period containing `entryDate` (inclusive at `from`, exclusive at `to`) |
| Reversing an auto-generated JE (e.g., loan disb.) | Allowed only by developer; logs warning that the underlying source still exists |
| Source row deleted (e.g., loan deleted) before JE is reversed | JE remains; UI shows the source link as `(deleted)` |
| Bill paid → reversed → re-paid | Both pay and reversal JEs are kept; balance correctly returns to the original state |
| Concurrent posts of two entries on the same date and account | Both succeed (no per-account lock); `account_balances` updates use `INCREMENT` (no read-modify-write) |
| Manual JE referencing a soft-deleted account | Account dropdown hides inactive accounts; server re-validates |
| User pastes a multi-line value into "amount" field | Rejected with `negative_amount` if invalid format |
| User refreshes the new-entry page after auto-save | Draft is restored by id (last draft per user resumed) |

---

## 12. Test scenarios

| ID | Scenario | Expected |
|---|---|---|
| JE-01 | Post a balanced 2-line manual JE within cap | `status=posted`, `entryNo` assigned, balances bumped |
| JE-02 | Post a 2-line JE where Dr 1000 / Cr 999 | Rejected `not_balanced` |
| JE-03 | Save draft with 1 line | Saved (drafts skip balance check) |
| JE-04 | Submit draft for approval with invalid account | Rejected `account_invalid` |
| JE-05 | Posting in a locked period | Rejected `period_locked` |
| JE-06 | Posting amount above admin cap | Auto-routes to `pending_approval`, queue row created |
| JE-07 | Approver rejects with note | Status `rejected`, note saved, no balance change |
| JE-08 | Reverse a posted JE | New JE created with swapped debits/credits, originals marked `reversed` |
| JE-09 | Auto-generated JE from new loan creation | `sourceType=loan_disbursement`, `sourceId=loan.id`, idempotent if cron re-runs |
| JE-10 | Tax line GST_18 on expense 1000 | Splits to `Dr Expense 1000`, `Dr Input GST 180`, `Cr Bank 1180` |
| JE-11 | Branch filter applied to list | Only entries with `branchId=current` are shown |
| JE-12 | Drill from P&L "Salaries" cell | Lands on list pre-filtered by that account + period |
| JE-13 | Print voucher PDF | Renders header, lines, totals, signatures placeholder |
| JE-14 | Upload 6th attachment | Rejected, max 5 |
| JE-15 | Concurrent post of 100 JEs same minute | All succeed, no duplicate `entryNo`, balances correct |

---

## 13. Acceptance criteria

1. Manual JEs must always balance to post; drafts may be unbalanced.
2. Auto-generated JEs are idempotent on `(sourceType, sourceId)`.
3. Reversal is via offset entry, not by deleting/editing the original.
4. Entry numbers are gapless within `(tenant, FY)` and assigned only at post time.
5. List page paginates correctly past 100k rows.
6. Detail page audit trail shows creator, approver, attachments, reversal link.
7. Period lock blocks every post; reversal of a posted entry in a closed period requires re-opening the period (see 12).
8. Branch scope is respected on list, totals, and approval queue.
