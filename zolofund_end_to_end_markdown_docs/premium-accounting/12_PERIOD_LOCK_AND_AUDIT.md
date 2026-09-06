# 12 · Period Lock & Audit

> Close accounting periods so historical numbers can't drift, and keep an immutable audit log of every premium-accounting action.

---

## 1. Purpose

- Carve the timeline into monthly accounting periods (`open` → `soft_locked` → `locked` → `closed`).
- Run "Period close" routine that transfers Net Profit to `Current Year Earnings` and zeroes income/expense buckets.
- Block any mutation that would touch a `locked` or `closed` period.
- Maintain an append-only `accounting_audit_log` (who, what, when, before/after JSON snippet).

---

## 2. Route & access

| | |
|---|---|
| **Route** | `/<module>/accounting/premium/period-lock` |
| **File** | `app/(dashboard)/[module]/accounting/premium/period-lock/page.tsx` |
| **Client** | `app/(dashboard)/[module]/accounting/premium/period-lock/PeriodLockClient.tsx` |
| **Actions** | `app/(dashboard)/[module]/accounting/premium/period-lock/actions.ts` |
| **Role gate (read)** | `admin` / `superadmin` / `developer` |
| **Role gate (write — lock/close/unlock)** | `superadmin` / `developer` |
| **Subscription gate** | `premiumAccountingEnabled` |

---

## 3. Data model

```prisma
model AccountingPeriod {
  id           String   @id @default(cuid())
  tenantId     String   @map("tenant_id")
  periodKey    String   @map("period_key")           // '2026-05'
  periodFrom   DateTime @map("period_from") @db.Date
  periodTo     DateTime @map("period_to") @db.Date
  fiscalYear   String   @map("fiscal_year")          // '2026-27'
  status       String   @default("open")             // 'open' | 'soft_locked' | 'locked' | 'closed'
  closingJEId  String?  @map("closing_je_id")        // FK to the period-close JE (created on 'closed')
  lockedById   String?  @map("locked_by_id")
  lockedAt     DateTime? @map("locked_at")
  closedById   String?  @map("closed_by_id")
  closedAt     DateTime? @map("closed_at")
  notes        String?  @db.Text
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  lockedBy     User?    @relation("PeriodLocker", fields: [lockedById], references: [id])
  closedBy     User?    @relation("PeriodCloser", fields: [closedById], references: [id])
  closingJE    JournalEntry? @relation("PeriodClosingJE", fields: [closingJEId], references: [id])
  locks        PeriodLock[]
  @@unique([tenantId, periodKey])
  @@index([tenantId, status])
  @@map("accounting_periods")
}

model PeriodLock {
  id           String   @id @default(cuid())
  periodId     String   @map("period_id")
  action       String                                // 'soft_lock' | 'lock' | 'unlock' | 'close' | 'reopen'
  reason       String?  @db.Text
  byUserId     String   @map("by_user_id")
  createdAt    DateTime @default(now()) @map("created_at")

  period       AccountingPeriod @relation(fields: [periodId], references: [id], onDelete: Cascade)
  byUser       User             @relation(fields: [byUserId], references: [id])
  @@index([periodId, createdAt])
  @@map("period_locks")
}

model AccountingAuditLog {
  id           String   @id @default(cuid())
  tenantId     String   @map("tenant_id")
  userId       String?  @map("user_id")
  action       String                                // 'create' | 'update' | 'delete' | 'post' | 'reverse' | 'approve' | 'reject' | 'lock_period' | 'close_period' | 'reopen_period' | 'override' | 'recompute_gst'
  entityType   String   @map("entity_type")          // 'journal_entry' | 'account' | 'bill' | 'budget' | 'period' | 'tds' | 'gst_summary' | 'bank_statement' | 'settings'
  entityId     String?  @map("entity_id")
  before       String?  @db.Text                     // JSON snippet
  after        String?  @db.Text                     // JSON snippet
  diff         String?  @db.Text                     // optional pre-computed JSON-patch
  ipAddress    String?  @map("ip_address")
  userAgent    String?  @map("user_agent") @db.Text
  reason       String?  @db.Text
  createdAt    DateTime @default(now()) @map("created_at")

  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user         User?    @relation("AccountingAuditUser", fields: [userId], references: [id])
  @@index([tenantId, entityType, entityId, createdAt])
  @@index([tenantId, createdAt])
  @@map("accounting_audit_log")
}
```

---

## 4. Period lifecycle

```
       ┌──────────┐  soft_lock   ┌─────────────┐   lock    ┌────────┐  close  ┌─────────┐
       │   open   │ ────────────▶│ soft_locked │ ─────────▶│ locked │────────▶│ closed  │
       └──────────┘              └─────────────┘           └────────┘         └─────────┘
            ▲                          │                       │                  │
            └───── unlock (with reason, audit-logged) ─────────┴── reopen ────────┘
```

| Status | Who can post JEs? | Recompute GST? | Edit budgets? | Notes |
|---|:---:|:---:|:---:|---|
| `open` | anyone (per rules) | yes | yes | Active month |
| `soft_locked` | only with override flag | yes | yes | Used while finalising — admins blocked, superadmin/developer can still post |
| `locked` | nobody | yes (read-only output) | no | Statements frozen |
| `closed` | nobody | yes (output frozen too) | no | Closing JE has been written |

Re-opening a locked or closed period requires `superadmin`/`developer` role + a reason (audit-logged) and triggers a recompute of dependent reports.

---

## 5. UI

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Premium > Period Lock & Audit                                            │
├──────────────────────────────────────────────────────────────────────────┤
│ Fiscal year: [FY 2026-27 ▾]                                              │
│                                                                          │
│ Period      Status        Net Profit    Closing JE   Action              │
│ ──────────  ────────────  ───────────   ──────────   ──────────────────  │
│ Apr 2026    closed        52,900        JE-2026-099  [Reopen]            │
│ May 2026    locked        37,000        —            [Close]  [Unlock]   │
│ Jun 2026    soft_locked   —             —            [Lock]   [Unlock]   │
│ Jul 2026    open          —             —            [Soft lock]         │
│ Aug 2026    open          —             —            (read-only)         │
│ ...                                                                      │
│                                                                          │
│ ─── Audit log (last 50) ───────────────────────────────────────────────  │
│ 21-May 14:02  developer  close_period   Apr 2026           ✎             │
│ 21-May 13:50  superadmin lock_period    May 2026  reason:'GSTR-3B filed' │
│ 20-May 09:11  admin      post           JE-2026-100  …                   │
│ ...                                                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Close period flow

When `[Close]` clicked:

1. Confirm modal: "Close May 2026? Net Profit ₹37,000 will be transferred to Current Year Earnings."
2. Server transaction:
   - Recompute P&L for the period (re-read journal lines).
   - Create a closing JE (`sourceType='period_close'`, `entryDate=periodTo`, `narration='Close May 2026'`) with lines:
     - For every income account with non-zero closing credit: `Dr <Income account> X, Cr 3300 Current Year Earnings X`.
     - For every expense account with non-zero closing debit: `Cr <Expense account> Y, Dr 3300 Current Year Earnings Y`.
     - Net effect zeroes income/expense, +Net Profit to Current Year Earnings.
   - Update period: `status='closed'`, `closedAt=now`, `closedById=user`, `closingJEId=newJE.id`.
   - Audit log entry.
3. Optionally **auto-creates** the next period in `open` state if not already created.

### Lock flow

- `Soft lock` → blocks `admin` writes but lets `superadmin`/`developer` post.
- `Lock` → blocks ALL writes including superadmin (developer can override but it's logged with a banner-level audit).

### Unlock flow

Modal requires:
- Reason (required, ≥ 10 chars).
- Side effect notice ("Reopening will allow new JEs in this period and may invalidate filed GST returns").
- Audit log entry with reason.

### Reopen closed period

- Reverses the closing JE (creates an offsetting JE `sourceType='reversal'` linked back).
- Resets period status to `open` (or `locked` if a prior intermediate state is preserved).
- Audit log with reason.

---

## 6. Server actions

```ts
export async function ensurePeriodExists(tenantId: string, date: Date): Promise<AccountingPeriod>;

export async function softLockPeriod(periodId: string, reason?: string): Promise<ActionResult>;
export async function lockPeriod(periodId: string, reason?: string): Promise<ActionResult>;
export async function closePeriod(periodId: string): Promise<ActionResult<{ closingJEId: string }>>;
export async function unlockPeriod(periodId: string, reason: string): Promise<ActionResult>;
export async function reopenPeriod(periodId: string, reason: string): Promise<ActionResult>;

// Audit
export async function listAuditLog(filter: AuditFilter, cursor?: string, limit = 50): Promise<{ rows: AccountingAuditLog[]; nextCursor: string | null }>;
```

`ensurePeriodExists` is called lazily before every JE post; it creates the period row on demand with `status='open'`.

---

## 7. Audit log

Captures every premium-accounting mutation. Specifically:

| Action key | Entity types it appears on |
|---|---|
| `create` | journal_entry, account, bill, budget, vendor, bank_statement, attachment |
| `update` | account, bill, vendor, budget, settings, ... |
| `delete` | (soft-deletes mostly) account, vendor |
| `post` | journal_entry, bill |
| `pay` | bill |
| `cancel` | bill |
| `reverse` | journal_entry |
| `approve` | journal_entry, bill, budget |
| `reject` | journal_entry, bill |
| `lock_period`, `soft_lock_period` | period |
| `close_period`, `reopen_period`, `unlock_period` | period |
| `override` | journal_entry (developer post in locked period) |
| `recompute_gst`, `mark_gst_filed` | gst_summary |
| `match` / `unmatch` / `ignore` | bank_statement_line |
| `import_statement` | bank_statement |
| `record_challan` | tds |

`before`/`after` columns hold short JSON snapshots, not full row dumps — only the changed fields plus the row's primary identity.

### Audit log viewer

Same page (bottom half) lists the last 50 entries, with filters: date range, action, entityType, user. Pagination by cursor.

Click ✎ on a row → detail drawer showing parsed `before` / `after` diff.

---

## 8. i18n (`pa.periodLock`)

```ts
pa: {
  periodLock: {
    title: 'Period Lock & Audit',
    fiscalYear: 'Fiscal year',
    columns: {
      period: 'Period', status: 'Status', netProfit: 'Net Profit', closingJE: 'Closing JE', action: 'Action',
    },
    status: {
      open: 'Open', soft_locked: 'Soft-locked', locked: 'Locked', closed: 'Closed',
    },
    actions: {
      softLock: 'Soft lock', lock: 'Lock', close: 'Close',
      unlock: 'Unlock', reopen: 'Reopen',
    },
    closeConfirm: {
      title: 'Close {period}?',
      body: 'Net Profit {netProfit} will be transferred to Current Year Earnings.',
      cta: 'Close period',
    },
    unlockConfirm: {
      title: 'Reopen {period}?',
      reasonLabel: 'Reason (required)',
      warning: 'Reopening allows new JEs and may invalidate filed GST returns.',
      cta: 'Reopen',
    },
    auditTitle: 'Audit log',
    auditFilters: {
      action: 'Action', entity: 'Entity', user: 'User', from: 'From', to: 'To',
    },
    auditViewDetail: 'View detail',
    errors: {
      period_in_use: 'Cannot lock — JE posts in progress.',
      no_reason: 'Reason is required.',
      close_unbalanced: 'Cannot close — books are not balanced.',
      reopen_filed_gst: '⚠ GST is already filed for this period.',
    },
  },
}
```

---

## 9. Edge cases

| Case | Behaviour |
|---|---|
| Posting a JE on a date in a non-existent period | `ensurePeriodExists` auto-creates the period in `open` state |
| Posting in a `soft_locked` period as admin | Blocked with `period_locked` error |
| Posting in a `locked` period as superadmin | Blocked; only developer can override and it's audit-logged |
| Closing when books are unbalanced | Blocked with `close_unbalanced`; integrity check link offered |
| Closing twice | Idempotent: closing an already-closed period is a no-op |
| Reopening a closed period that has a filed GST return | Warning; allowed; audit log includes acknowledgement |
| Backdating an entry to a previous fiscal year | If FY still `open` (rare), allowed; else blocked |
| Concurrent close + post race | Transactional select-for-update on period row; one wins |
| Closing without a `3300 Current Year Earnings` account | Auto-creates it from default seed |
| Reopen rollback fails halfway | Transactional; partial state never persists |

---

## 10. Test scenarios

| ID | Scenario | Expected |
|---|---|---|
| PL-01 | Close May with Net Profit 37,000 | Closing JE created with 37,000 to `3300` |
| PL-02 | Close period twice | Second call no-op |
| PL-03 | Lock period; admin tries to post | Rejected |
| PL-04 | Lock period; superadmin posts | Rejected |
| PL-05 | Lock period; developer overrides | Allowed; audit log records `override` |
| PL-06 | Reopen closed period | Closing JE reversed; status → `open`; both rows audit-logged |
| PL-07 | Unbalanced books, close attempt | `close_unbalanced` |
| PL-08 | Audit log filtered by `entity=bill action=post` | Shows only bill post entries |
| PL-09 | Soft lock allows superadmin posts | Verified |
| PL-10 | Concurrent post + lock | One wins, no partial state |

---

## 11. Acceptance criteria

1. Every premium-accounting mutation produces exactly one audit log row.
2. Period close generates a self-balancing JE and zeroes income/expense.
3. Reopening a closed period reverses the closing JE atomically.
4. Locked periods are write-blocked for everyone except developer override (logged).
5. Audit log is append-only (no UPDATE / DELETE in DB layer; enforced by app code; can be enforced via MySQL TRIGGER as v2).
6. Audit log filters perform under 200 ms on 100k rows (index covered).
7. UI surface clearly explains downstream effects of unlock / reopen.
