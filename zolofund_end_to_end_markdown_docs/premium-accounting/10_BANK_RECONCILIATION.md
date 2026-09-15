# 10 · Bank Reconciliation

> Import bank statements, match to ledger journal lines, propose new entries for unmatched bank debits/credits, surface discrepancies.

---

## 1. Purpose

- Maintain a `bank_accounts` master list per tenant (HDFC #1234, SBI #5678, etc.) mapped 1:1 to a CoA account (typically code 1210/1220).
- Import bank statement files (CSV / XLSX / OFX / camt.053 XML).
- For each imported line, try to **auto-match** against existing journal lines on the corresponding ledger account. Manual confirmation for low-confidence matches.
- For unmatched bank lines, let the user create a JE on the fly.
- Compute "Reconciled balance" = book balance − unreconciled book lines + unreconciled bank lines. When everything matches, this equals statement closing balance.

---

## 2. Route & access

| | |
|---|---|
| **Route** | `/<module>/accounting/premium/bank-rec` |
| **Sub-route** | `/<module>/accounting/premium/bank-rec/[bankAccountId]` |
| **File** | `app/(dashboard)/[module]/accounting/premium/bank-rec/page.tsx` (list) and `[bankAccountId]/page.tsx` (workspace) |
| **Actions** | `app/(dashboard)/[module]/accounting/premium/bank-rec/actions.ts` |
| **Role gate** | `admin` / `superadmin` / `developer` |
| **Subscription gate** | `premiumAccountingEnabled` |

---

## 3. Data model

```prisma
model BankAccount {
  id            String   @id @default(cuid())
  tenantId      String   @map("tenant_id")
  branchId      String?  @map("branch_id")
  name          String                                // 'HDFC Current'
  bankName      String   @map("bank_name")            // 'HDFC Bank'
  accountNo     String   @map("account_no")
  ifsc          String?
  ledgerAccountId String @map("ledger_account_id")    // FK to accounts (code 1210 etc.)
  openingBalance Decimal @default(0) @db.Decimal(18, 2)
  openingAsOf   DateTime @map("opening_as_of") @db.Date
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  branch        Branch?  @relation(fields: [branchId], references: [id])
  ledgerAccount Account  @relation(fields: [ledgerAccountId], references: [id])
  statements    BankStatement[]
  @@unique([tenantId, accountNo])
  @@map("bank_accounts")
}

model BankStatement {
  id            String   @id @default(cuid())
  bankAccountId String   @map("bank_account_id")
  fileName      String   @map("file_name")
  fileFormat    String   @map("file_format")          // 'csv' | 'xlsx' | 'ofx' | 'camt053'
  statementFrom DateTime @map("statement_from") @db.Date
  statementTo   DateTime @map("statement_to") @db.Date
  openingBalance Decimal @db.Decimal(18, 2)
  closingBalance Decimal @db.Decimal(18, 2)
  status        String   @default("imported")         // 'imported' | 'matching' | 'reconciled'
  importedById  String   @map("imported_by_id")
  importedAt    DateTime @default(now()) @map("imported_at")
  lines         BankStatementLine[]

  bankAccount   BankAccount @relation(fields: [bankAccountId], references: [id], onDelete: Cascade)
  @@index([bankAccountId, statementFrom])
  @@map("bank_statements")
}

model BankStatementLine {
  id               String   @id @default(cuid())
  statementId      String   @map("statement_id")
  postingDate      DateTime @map("posting_date") @db.Date
  valueDate        DateTime? @map("value_date") @db.Date
  description      String   @db.Text
  reference        String?                          // bank's reference number
  debit            Decimal  @default(0) @db.Decimal(18, 2)
  credit           Decimal  @default(0) @db.Decimal(18, 2)
  runningBalance   Decimal? @db.Decimal(18, 2)
  matchedJournalLineId String? @map("matched_journal_line_id")
  status           String   @default("unmatched")     // 'unmatched' | 'matched' | 'ignored'
  matchedAt        DateTime? @map("matched_at")
  matchedById      String?   @map("matched_by_id")
  rawData          String?   @map("raw_data") @db.LongText

  statement        BankStatement @relation(fields: [statementId], references: [id], onDelete: Cascade)
  matchedJournalLine JournalLine? @relation(fields: [matchedJournalLineId], references: [id])
  proposals        BankMatchProposal[]
  @@index([statementId, postingDate])
  @@index([status])
  @@map("bank_statement_lines")
}

model BankMatchProposal {
  id                  String   @id @default(cuid())
  statementLineId     String   @map("statement_line_id")
  journalLineId       String   @map("journal_line_id")
  score               Decimal  @db.Decimal(5, 4)        // 0.0000–1.0000
  reason              String   @db.Text                 // human-readable
  createdAt           DateTime @default(now()) @map("created_at")

  statementLine       BankStatementLine @relation(fields: [statementLineId], references: [id], onDelete: Cascade)
  journalLine         JournalLine       @relation(fields: [journalLineId], references: [id])
  @@unique([statementLineId, journalLineId])
  @@map("bank_match_proposals")
}
```

---

## 4. UI — Bank accounts list

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Premium > Bank Reconciliation                                            │
│ [+ New Bank Account]                                                     │
├──────────────────────────────────────────────────────────────────────────┤
│ Bank             A/c No        Ledger      Book Bal    Last Statement    │
│ ───────────────  ────────────  ──────────  ──────────  ──────────────    │
│ HDFC Current     XXX-1234      1210         30,000     31-May-26  ✔      │
│ SBI Current      XXX-5678      1220         20,000     30-Apr-26  ⚠ stale│
│ ICICI Salary     XXX-9012      1230         15,200     —          ●       │
│ Petty Cash       —             1100         12,340     n/a               │
└──────────────────────────────────────────────────────────────────────────┘
```

Click a row → workspace for that bank account.

---

## 5. UI — Reconciliation workspace

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Premium > Bank Rec > HDFC Current (1210)                                         │
│ [⬆ Import statement] [Mark reconciled] [Show only unmatched ☑]                   │
│ Period: 01-May-26 to 31-May-26   Book balance: 30,000   Bank closing: 30,000  ✔  │
├──────────────────────────────────────────────────────────────────────────────────┤
│  BANK SIDE                            │  LEDGER SIDE                             │
│ ─────────────────────────────────────  │ ──────────────────────────────────────  │
│  03-May  RTGS REF#12345                │  03-May  JE-2026-005 Loan disb. L0014   │
│           Cr  50,000                   │           Dr  50,000      [→ matched]   │
│  ────────────────────────────────────  │  ─────────────────────────────────────  │
│  05-May  IMPS REF#22011                │  ⚠ no match (1 proposal, 92%)           │
│           Dr  1,200                    │  Proposal: JE-2026-007 collection L0007 │
│                                        │  [Accept]  [Reject]  [Create new JE]    │
│  ────────────────────────────────────  │  ─────────────────────────────────────  │
│  06-May  SAL HDFC TRF                  │  Manual entry needed                    │
│           Cr  60,000                   │  [Create JE: Dr ? / Cr 1210 60,000]     │
│  ────────────────────────────────────  │  ─────────────────────────────────────  │
│  ...                                                                             │
│                                                                                  │
│ Unmatched: 2 lines (₹61,200 net)                                                 │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Two-column comparison: bank statement lines on the left, matched ledger lines (or proposals) on the right. The workspace is wrapped in a virtualised list since real statements can have 1,000+ lines.

### Actions per line

- **[Accept]** proposal → links `BankStatementLine.matchedJournalLineId` to the proposal's JE line; sets `status='matched'` on both. Both sides marked green.
- **[Reject]** proposal → deletes only that proposal; line stays unmatched.
- **[Create new JE]** opens a quick-create modal pre-filled with `entryDate`, the bank side (Dr or Cr to ledger account `1210`), and an empty counter-side that the user picks from CoA. On submit, the new JE posts and auto-matches.
- **Ignore** → marks line `status='ignored'` (e.g., bank charge < ₹1 rounding).

### Mark reconciled

Button at top right. Available only when:
- All bank lines are `matched` or `ignored`.
- Statement closing balance equals book balance at `statementTo`.

On click, sets `BankStatement.status='reconciled'`, locks the statement (no more edits), and writes an audit log.

---

## 6. Matching engine (`lib/accounting/bankMatching.ts`)

For each unmatched bank line, find candidate journal lines:

```sql
SELECT * FROM journal_lines jl
JOIN journal_entries je ON je.id = jl.entry_id
WHERE jl.account_id = $ledgerAccountId
  AND je.tenant_id = $tenantId
  AND je.posting_date BETWEEN $line.postingDate - 5 days AND $line.postingDate + 5 days
  AND je.status = 'posted'
  AND ABS((jl.debit + jl.credit) - ($line.debit + $line.credit)) < 0.01
  AND jl.id NOT IN (SELECT matched_journal_line_id FROM bank_statement_lines WHERE matched_journal_line_id IS NOT NULL)
```

Score each candidate:

| Signal | Weight |
|---|---|
| Exact amount match | +0.40 |
| Same date | +0.20 |
| Date within ±1 day | +0.10 |
| Description token overlap (Jaccard ≥ 0.5) | +0.20 |
| Reference number contained in description | +0.10 |

Threshold ≥ 0.85 → auto-match. 0.60–0.85 → propose. < 0.60 → no proposal.

Auto-matched lines still show in the workspace but pre-checked; user can override.

---

## 7. Statement parsers

```ts
parsers/csv.ts        // configurable mapping: date col, desc col, debit col, credit col, ref col
parsers/xlsx.ts       // wrapper around csv parser using xlsx library
parsers/ofx.ts        // OFX 1.x and 2.x
parsers/camt053.ts    // SEPA ISO 20022 (future, stub)
```

CSV parser uses a per-bank preset config (`hdfc-default.json`, `sbi-default.json` shipped with the module) plus a custom-mapping UI for unknown formats.

Validation rule on import: file's `openingBalance` must match book balance at `statementFrom` − 1; if mismatch > ₹0.01, import is blocked with diagnostic.

---

## 8. Server actions

```ts
// Bank account CRUD
export async function createBankAccount(input: BankAccountInput): Promise<ActionResult<BankAccount>>;
export async function updateBankAccount(id: string, input: Partial<BankAccountInput>): Promise<ActionResult>;
export async function deactivateBankAccount(id: string): Promise<ActionResult>;

// Statement import
export async function importStatement(bankAccountId: string, file: File, mapping?: CsvMapping): Promise<ActionResult<BankStatement>>;
export async function deleteStatement(id: string): Promise<ActionResult>;

// Matching
export async function rebuildProposals(statementId: string): Promise<ActionResult<{ matched: number; proposed: number }>>;
export async function acceptProposal(proposalId: string): Promise<ActionResult>;
export async function rejectProposal(proposalId: string): Promise<ActionResult>;
export async function ignoreLine(statementLineId: string): Promise<ActionResult>;
export async function unmatch(statementLineId: string): Promise<ActionResult>;

// Create JE inline
export async function createMatchingEntry(statementLineId: string, counterAccountId: string, narration?: string): Promise<ActionResult>;

// Finalise
export async function markReconciled(statementId: string): Promise<ActionResult>;
```

---

## 9. i18n (`pa.bankRec`)

```ts
pa: {
  bankRec: {
    listTitle: 'Bank Reconciliation',
    addAccount: '+ New Bank Account',
    importBtn: '⬆ Import statement',
    markReconciled: 'Mark reconciled',
    showUnmatched: 'Show only unmatched',
    bankSide: 'BANK SIDE',
    ledgerSide: 'LEDGER SIDE',
    matched: 'matched',
    noMatch: 'no match',
    proposalLine: '{count} proposal · {pct}%',
    accept: 'Accept',
    reject: 'Reject',
    createNew: 'Create new JE',
    ignore: 'Ignore',
    unmatch: 'Unmatch',
    bookBalance: 'Book balance',
    bankClosing: 'Bank closing',
    unmatchedSummary: 'Unmatched: {n} lines ({amount} net)',
    importDialog: {
      title: 'Import statement',
      bankFormatHint: 'Pick HDFC / SBI preset or upload a custom CSV mapping.',
      fileLabel: 'File',
      previewFirstRows: 'Preview',
    },
    errors: {
      openingMismatch: 'Statement opening balance {imp} does not match book balance {book}.',
      duplicateStatement: 'This file (or overlapping period) has already been imported.',
      unsupportedFormat: 'Unsupported file format.',
    },
  },
}
```

---

## 10. Edge cases

| Case | Behaviour |
|---|---|
| Statement overlaps a previously imported one | Block import with "duplicate or overlapping period" |
| Two ledger lines exactly match a single bank line | Accept the higher-scored proposal; second remains as a proposal to be merged or rejected |
| Bank charge on statement, no ledger entry | "Create new JE" pre-fills Dr `5600 Bank Charges`, Cr `Bank` |
| Partial match (₹100 statement vs two ledger lines summing to ₹100) | Manual: user selects multiple ledger lines and clicks "Match group" (advanced; v2 feature) |
| Statement covers period inside a locked period | Allowed (import is a read-only artifact); creating any new JE is blocked |
| Bank statement balance differs from book by a single rounding ₹0.50 | Show banner; user can post a "Bank rec adjustment" JE in `Bank Charges` to absorb |
| User imports same file twice | File hash stored; duplicate import rejected |
| Bank account deactivated while statements exist | Bank account hidden from new imports; existing statements still browsable |

---

## 11. Test scenarios

| ID | Scenario | Expected |
|---|---|---|
| BR-01 | Import HDFC CSV 100 lines, 80 auto-match | 80 lines status=matched, 20 proposals or unmatched |
| BR-02 | Accept a 95% proposal | Both sides matched, audit log records user |
| BR-03 | Reject proposal then create new JE inline | Bank line matched to the new JE upon post |
| BR-04 | Mark reconciled when 2 lines still unmatched | Blocked with toast "All lines must be matched or ignored" |
| BR-05 | Statement opening ≠ book balance | Import blocked with diagnostic |
| BR-06 | Duplicate import detected | Rejected |
| BR-07 | Bank charges ignored | `status=ignored`, no JE created |
| BR-08 | Statement in locked period | Import allowed; creating JE blocked |
| BR-09 | Recompute proposals after deleting a JE | Stale proposals cleaned up; bank line back to unmatched |
| BR-10 | Statement closing ≠ book balance at end | "Mark reconciled" disabled with hint |

---

## 12. Acceptance criteria

1. Importer respects per-bank CSV mapping and supports OFX.
2. Auto-match threshold tuned to ≥ 90% precision on real HDFC/SBI samples (per QA suite).
3. Reconciliation requires book = bank at statement closing to lock.
4. Matched journal lines cannot be deleted without first unmatching (server-side guard).
5. Audit log records every accept / reject / ignore / unmatch / create-JE.
6. Workspace handles ≥ 1,000 lines without UI freeze (virtualised list).
