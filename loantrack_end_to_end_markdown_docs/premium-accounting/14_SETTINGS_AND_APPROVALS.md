# 14 · Settings & Approval Workflow

> Tenant-level premium accounting settings + multi-level approval queue for journal entries and bills above thresholds.

---

## 1. Purpose

- One place to configure premium-accounting behaviour: fiscal year, GSTIN/state, posting overrides, approval caps, alert thresholds, Tally connector, cost-centre toggle, base-accounting integration knobs.
- Approval queue that lists every JE / bill whose amount exceeds the configured cap; routes to the next approver based on rules.

---

## 2. Route & access

| | |
|---|---|
| **Settings route** | `/<module>/accounting/premium/settings` |
| **Approvals route** | `/<module>/accounting/premium/approvals` |
| **Files** | `app/(dashboard)/[module]/accounting/premium/settings/page.tsx` · `approvals/page.tsx` |
| **Actions** | `settings/actions.ts` · `approvals/actions.ts` |
| **Role gate (settings)** | `superadmin` / `developer` |
| **Role gate (approvals)** | `superadmin` / `developer` (and `admin` for the read-only view of their own submissions) |
| **Subscription gate** | `premiumAccountingEnabled` |

---

## 3. Data model

### 3.1 `accounting_settings`

Single row per tenant (composite key `tenantId`).

```prisma
model AccountingSettings {
  id                       String   @id @default(cuid())
  tenantId                 String   @unique @map("tenant_id")
  // Fiscal & GST
  fiscalYearStartMonth     Int      @default(4)  @map("fiscal_year_start_month")   // April for India
  baseCurrency             String   @default("INR")
  gstin                    String?
  state                    String?                                                  // 'KA' etc.
  gstScheme                String   @default("regular") @map("gst_scheme")          // 'regular' | 'composition' | 'exempt'

  // CoA / posting
  postingOverrides         String   @default("{}") @map("posting_overrides") @db.LongText // JSON
  costCentresEnabled       Boolean  @default(false) @map("cost_centres_enabled")

  // Base-accounting integration
  baseAccountingMode       String   @default("derive_only") @map("base_accounting_mode")
                                                                                    // 'derive_only' | 'mirror' | 'replace'
  showPremiumBannerInBase  Boolean  @default(true) @map("show_premium_banner_in_base")

  // Approval caps (in tenant currency)
  adminJeCap               Decimal  @default(50000) @map("admin_je_cap") @db.Decimal(18, 2)
  adminBillCap             Decimal  @default(100000) @map("admin_bill_cap") @db.Decimal(18, 2)
  twoLevelApprovalThreshold Decimal @default(500000) @map("two_level_approval_threshold") @db.Decimal(18, 2)

  // CoA write permissions
  adminCanEditCoA          Boolean  @default(false) @map("admin_can_edit_coa")
  adminCanLockPeriod       Boolean  @default(false) @map("admin_can_lock_period")

  // Alerts
  varianceAlertPct         Decimal  @default(15) @map("variance_alert_pct") @db.Decimal(6, 2)
  apOverdueAlertDays       Int      @default(7) @map("ap_overdue_alert_days")

  // Tally
  tallyConnectorEnabled    Boolean  @default(false) @map("tally_connector_enabled")
  tallyConnectorUrl        String?  @map("tally_connector_url")
  tallyCompanyName         String?  @map("tally_company_name")

  // Misc
  allowFutureDated         Boolean  @default(false) @map("allow_future_dated")
  defaultBankAccountId     String?  @map("default_bank_account_id")
  defaultCashAccountId     String?  @map("default_cash_account_id")

  createdAt                DateTime @default(now()) @map("created_at")
  updatedAt                DateTime @updatedAt @map("updated_at")

  tenant                   Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  defaultBankAccount       Account? @relation("DefaultBank",  fields: [defaultBankAccountId], references: [id])
  defaultCashAccount       Account? @relation("DefaultCash",  fields: [defaultCashAccountId], references: [id])
  @@map("accounting_settings")
}
```

### 3.2 `accounting_approvals`

```prisma
model AccountingApproval {
  id            String   @id @default(cuid())
  tenantId      String   @map("tenant_id")
  entityType    String   @map("entity_type")           // 'journal_entry' | 'bill' | 'budget'
  entityId      String   @map("entity_id")
  amount        Decimal  @db.Decimal(18, 2)
  level         Int      @default(1)                   // 1 = first, 2 = second
  approverRole  String   @map("approver_role")         // 'superadmin' | 'developer'
  status        String   @default("pending")           // 'pending' | 'approved' | 'rejected' | 'cancelled'
  approvedById  String?  @map("approved_by_id")
  reviewNote    String?  @map("review_note") @db.Text
  reviewedAt    DateTime? @map("reviewed_at")
  requestedById String   @map("requested_by_id")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  requestedBy   User     @relation("ApprovalRequester", fields: [requestedById], references: [id])
  approvedBy    User?    @relation("ApprovalApprover",  fields: [approvedById], references: [id])
  @@index([tenantId, status, level])
  @@index([entityType, entityId])
  @@map("accounting_approvals")
}
```

---

## 4. UI — Settings

Form is tabbed:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Premium > Settings                                          [Save]       │
├──────────────────────────────────────────────────────────────────────────┤
│ Tabs: [General] [GST] [CoA] [Approvals] [Alerts] [Tally] [Integration]   │
│                                                                          │
│ General                                                                  │
│   Fiscal year start month       [April ▾]                                │
│   Allow future-dated entries    [☐]                                      │
│   Default bank account          [1210 HDFC Current ▾]                    │
│   Default cash account          [1100 Cash on Hand ▾]                    │
│                                                                          │
│ GST                                                                      │
│   GSTIN                         [29ABCDE1234F1Z1            ]            │
│   State                         [Karnataka ▾]                             │
│   GST scheme                    [Regular ▾]                              │
│                                                                          │
│ Approvals                                                                │
│   Admin JE cap                  [₹  50,000     ]                          │
│   Admin Bill cap                [₹ 100,000     ]                          │
│   Two-level approval threshold  [₹ 500,000     ]                          │
│   Admins can edit CoA           [☐]                                      │
│   Admins can lock period        [☐]                                      │
│                                                                          │
│ Alerts                                                                   │
│   Variance alert threshold      [15 %]                                   │
│   AP overdue alert days         [7  ]                                    │
│                                                                          │
│ Tally Connector                                                          │
│   Enable                        [☐]                                      │
│   URL                           [http://localhost:9000    ]              │
│   Company name                  [LoanTrack Books          ]              │
│                                                                          │
│ Integration with base accounting                                         │
│   Mode                          [● Derive only] [○ Mirror] [○ Replace]   │
│   Show premium banner in base   [☑]                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Integration mode (key knob)

| Mode | Behaviour |
|---|---|
| `derive_only` (default) | Base accounting (existing `AccountEntry` table) stays as-is. Premium reads from `AccountEntry` + loans/collections to derive JEs but **does not** mirror premium JEs back into `AccountEntry`. The two views diverge over time (manual premium JEs don't show on base page). |
| `mirror` | Whenever a premium JE is posted, also append a row to `AccountEntry` so the basic page reflects it. Idempotent on `journalEntryId`. |
| `replace` | The base `/accounting` page is replaced with a redirect to `/accounting/premium`. Useful for tenants that have fully migrated. |

`showPremiumBannerInBase` toggles the "You have Premium — Open Premium →" banner on the base page.

### Posting overrides

Advanced editor (JSON or visual form). Example:

```json
{
  "LOAN_DISBURSEMENT": {
    "credit": { "code": "1220" }       // override default Bank '1210' to SBI '1220'
  },
  "COLLECTION_INTEREST": {
    "debit":  { "code": "1100" },
    "credit": { "code": "4150" }       // route interest income to a custom account
  }
}
```

Stored in `accountingSettings.postingOverrides`. Loaded by `lib/accounting/postings.ts` at runtime.

---

## 5. UI — Approvals queue

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Premium > Approvals                                                      │
├──────────────────────────────────────────────────────────────────────────┤
│ Filter: [type ▾] [level ▾] [requester ▾] [date range] [search…]          │
│                                                                          │
│ Entity      Amount      Level   Requested By   Date       Action         │
│ ───────────  ───────────  ─────  ─────────────  ─────────  ──────────     │
│ JE-2026-405   60,000     L1     admin (John)   21-May-26  [Approve] [✗]  │
│ Bill INV-205  85,000     L1     admin (John)   21-May-26  [Approve] [✗]  │
│ JE-2026-401  750,000     L2     superadmin     20-May-26  [Approve] [✗]  │
│ ...                                                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

- L1 approver = `superadmin` (by default; configurable to `developer` for sensitive tenants).
- L2 approver = `developer` (only when `amount > twoLevelApprovalThreshold`).
- Clicking the entity navigates to its detail page in a new tab; review note + approve/reject inline.

### Approval flow

1. Admin posts a JE for ₹60,000 with `adminJeCap=50,000`.
   - `submitForApproval` action: status `pending_approval`, `accounting_approvals` row created with `level=1`, `approverRole='superadmin'`.
   - Notification sent to all superadmins.
2. Superadmin opens approvals queue, hits Approve.
   - If `amount <= twoLevelApprovalThreshold`: JE posts immediately, approval row → `approved`.
   - Else: row → `approved`, new L2 row created with `approverRole='developer'`. Notification to developer.
3. Developer approves L2 → JE posts.

Rejection sets approval row → `rejected`, JE status → `rejected`. Audit log entry written.

### Approval cap formula

```ts
function canPostDirectly(user, amount) {
  if (user.role === 'developer') return true;
  if (user.role === 'superadmin') return amount <= settings.twoLevelApprovalThreshold;
  if (user.role === 'admin') return amount <= settings.adminJeCap;
  return false;
}
```

---

## 6. Server actions

### Settings

```ts
export async function getAccountingSettings(tenantId: string): Promise<AccountingSettings>;
export async function updateAccountingSettings(input: Partial<AccountingSettings>): Promise<ActionResult>;
export async function setPostingOverrides(overrides: Record<string, any>): Promise<ActionResult>;
```

### Approvals

```ts
export async function listApprovals(filter: ApprovalFilter): Promise<AccountingApproval[]>;
export async function approve(approvalId: string, note?: string): Promise<ActionResult>;
export async function reject(approvalId: string, note: string): Promise<ActionResult>;
export async function cancel(approvalId: string): Promise<ActionResult>;          // by requester before review
```

---

## 7. i18n (`pa.settings`, `pa.approvals`)

```ts
pa: {
  settings: {
    title: 'Settings',
    tabs: {
      general: 'General', gst: 'GST', coa: 'CoA',
      approvals: 'Approvals', alerts: 'Alerts', tally: 'Tally', integration: 'Integration',
    },
    general: {
      fyStart: 'Fiscal year start month',
      allowFuture: 'Allow future-dated entries',
      defaultBank: 'Default bank account',
      defaultCash: 'Default cash account',
    },
    gst: {
      gstin: 'GSTIN', state: 'State', scheme: 'GST scheme',
      schemes: { regular: 'Regular', composition: 'Composition', exempt: 'Exempt' },
    },
    approvals: {
      adminJeCap: 'Admin JE cap',
      adminBillCap: 'Admin Bill cap',
      twoLevel: 'Two-level approval threshold',
      adminEditCoa: 'Admins can edit CoA',
      adminLockPeriod: 'Admins can lock period',
    },
    alerts: {
      variancePct: 'Variance alert threshold (%)',
      apOverdueDays: 'AP overdue alert (days)',
    },
    tally: {
      enable: 'Enable Tally connector',
      url: 'Tally connector URL',
      company: 'Tally company name',
    },
    integration: {
      modeLabel: 'Integration mode',
      modeDeriveOnly: 'Derive only',
      modeMirror: 'Mirror to base',
      modeReplace: 'Replace base',
      showBanner: 'Show premium banner in base accounting',
    },
    save: 'Save',
    saved: 'Settings saved',
    errors: {
      gstinInvalid: 'GSTIN format invalid',
      capInvalid: 'Caps must be ≥ 0',
    },
  },
  approvals: {
    title: 'Approvals',
    columns: {
      entity: 'Entity', amount: 'Amount', level: 'Level', requester: 'Requested By', date: 'Date', action: 'Action',
    },
    approveBtn: 'Approve',
    rejectBtn: 'Reject',
    cancelBtn: 'Cancel request',
    noteLabel: 'Review note',
    statuses: {
      pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled',
    },
    routedToL2: 'Routed to developer (L2)',
    notifications: {
      submitted: 'New approval request — {entity} for {amount}',
      approved: 'Your request {entity} was approved.',
      rejected: 'Your request {entity} was rejected.',
    },
  },
}
```

---

## 8. Edge cases

| Case | Behaviour |
|---|---|
| Settings updated mid-flight, in-flight JE no longer over the new cap | The in-flight JE's approval row remains until reviewed; no auto-approve |
| Two-level threshold lowered after a single-level approval was given | New requests follow the new rule; existing pending row stays untouched |
| Approver rejects an entry that is already cancelled by requester | No-op with toast "Already cancelled" |
| Developer approval queue is empty but L1 approvals pile up | Surfaced as notification to superadmin daily digest |
| Posting overrides reference a deleted account code | Loader logs warning; falls back to default mapping |
| GSTIN changed | Re-binds tax computation immediately; existing journal lines are not retroactively changed |
| Cost centres enabled then disabled later | Existing costCentreId references kept on journal lines but UI hidden |
| Branch budgets exist when admins-can-lock-period disabled | Lock-period action hidden from admins; budgets unaffected |
| Default bank account deactivated | Auto-derivation falls back to first active bank account; setting prompts user to fix |
| Settings save with invalid GSTIN regex | Saves nothing, returns `gstinInvalid` |

---

## 9. Test scenarios

| ID | Scenario | Expected |
|---|---|---|
| SET-01 | Set adminJeCap to 100,000 | Admin can post up to 100K directly |
| SET-02 | Set integration mode to `mirror` and post a premium JE | A matching row appears in `AccountEntry` |
| SET-03 | Set GSTIN invalid | Save rejected with `gstinInvalid` |
| SET-04 | Toggle variance alert to 10 | Variance > 10% on any line triggers next cron's notification |
| SET-05 | Posting overrides with valid JSON | Loaded at next JE auto-derivation |
| SET-06 | Posting overrides invalid JSON | Save rejected |
| APR-01 | Admin posts JE 60K, cap 50K | Routed to L1 superadmin |
| APR-02 | Superadmin approves L1 entry above L2 threshold | Routed to developer |
| APR-03 | Developer approves L2 | JE posts; status `posted` |
| APR-04 | Requester cancels pending L1 | Status `cancelled` |
| APR-05 | Approver rejects with note | Status `rejected`, note stored, audit logged |
| APR-06 | Multiple in-flight JEs hit cap simultaneously | All routed independently; no race conditions |
| APR-07 | Approval queue paginated past 1000 rows | Cursor pagination works |
| APR-08 | Notification on approve | Requester gets in-app + (if enabled) SMS via `lib/notify/events.ts` |

---

## 10. Acceptance criteria

1. Settings are tenant-scoped; one row per tenant.
2. Approval workflow correctly cascades L1 → L2 when amount > threshold.
3. Posting overrides hot-reload (no app restart required).
4. Integration mode changes take effect immediately for new posts.
5. `mirror` mode never produces duplicate `AccountEntry` rows (idempotent on `journalEntryId`).
6. Approvals UI lists only rows that the current user is authorised to approve.
7. Audit log captures every settings change, approve, reject, cancel.
8. Notifications go out via the unified `lib/notify/events.ts` channel.
9. Caps validation is server-side; client UI only mirrors the same rules.
