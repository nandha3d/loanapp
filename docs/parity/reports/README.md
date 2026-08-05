# ZoloFund Reports — Master Index & Build Spec

> **Goal.** Every report a lending platform needs (the 14-section operator list) + our own module
> reports (gold, property, product-finance, chit, wallet), each with a **table rendered on screen first**
> and a one-click **PDF / Excel / CSV / Print** export.
>
> **This folder is documentation only.** Each report has its own ultra-detailed `.md` spec. Implementers
> build *against* these specs. Reports are **read-only aggregations** — see the Strict Rules below.

---

## Strict Rules (apply to EVERY report — non-negotiable)

1. **Read-only.** A report endpoint only `findMany` / `aggregate` / `groupBy`. It **never** writes,
   updates, or deletes. No `create`, no `update`, no money mutation, ever.
2. **Do not touch core models or logic.** No edits to loan origination, payment posting, instalment
   generation, penalty accrual, gold servicing, or accounting journal logic. Reports *consume* those
   tables; they do not change them.
3. **No schema changes by default.** Reports run on existing columns. If a report genuinely needs an
   **additive index** for performance, it is flagged with a ⚠️ **Structure-Impact** callout and a gated
   SQL file under `docs/parity/migrations/` — **never auto-applied**, never a new column without sign-off.
4. **No hardcoding.** Every threshold, bucket edge, label, currency symbol, prefix, rate, and enum list
   comes from the DB — `AppSetting` (`getSetting`/`setSetting`), catalog tables, or the queried row.
   No magic numbers or hardcoded option lists in UI or API.
5. **Tenant + module isolation always.** Every query spreads `appScope(appType)` and `scopedBranchWhere(ctx)`.
   Agents see only their scope; superadmin/developer see the tenant. Verified in every spec.
6. **Table first, then export.** UI renders the data table on screen *before* any download. Export
   reproduces the **exact same columns** the user sees — no divergence between screen and file.
7. **Six languages.** All headings/labels are `reports.*` i18n keys (en + ta/hi/te/kn/ml mirrors).

The shared mechanics (viewer shell, filter bar, export engine, charts) live once in
[`00-REPORT-FRAMEWORK.md`](./00-REPORT-FRAMEWORK.md). Every per-report doc references it instead of repeating it.

---

## Reuse map (do NOT reinvent)

| Need | Reuse | Location |
|---|---|---|
| Read-only aggregation pattern | `buildReportData()` | `lib/reports/data.ts:13` |
| Tenant/module/branch scope | `appScope()` + `scopedBranchWhere()` | `lib/scope.ts:58`, `lib/api/v1-auth.ts:106` |
| API auth context | `requireMobileContext()` / `auth()` | `lib/api/v1-auth.ts:126`, `app/api/export/collections/route.ts:7` |
| Response envelope | `ok()` / `fail()` | `lib/api/v1-envelope.ts:37` |
| Date/branch/agent filters | ISO `from`/`to` + midnight-normalize | `app/api/v1/reports/agent/route.ts:11` |
| PDF | generalize `CollectionReportPDF` → `TableReportPDF` | `lib/reports/pdf.tsx` |
| Excel | `exceljs` (already in deps) → `lib/reports/excel.ts` | `package.json` |
| CSV | quote-escape + `Content-Disposition` | `app/api/export/collections/route.ts:36` |
| Per-tenant config | `getSetting`/`setSetting` (`AppSetting`) | `lib/tenant.ts:267` |
| i18n (6 langs) | `reports.*` keys, `getDictionary()` | `i18n/en.ts:801`, `lib/i18n.ts:33` |
| Subscription/RBAC gate | `receiptPdfAllowed`, `isPremiumAccountingEnabled` | `app/(dashboard)/[module]/reports/ReportsClient.tsx:107` |

---

## Gap matrix — what exists vs what's new

**Legend:** ✅ EXISTS (document only) · 🔧 ENHANCE (extend existing) · 🆕 NEW (build) · 💎 module-gated

### 02 — Loan Reports
| Report | Status | Spec | Existing code |
|---|---|---|---|
| Loan Register | 🆕 | [02-loan-register.md](./02-loan-register.md) | — |
| Loan Status Report | 🆕 | [02-loan-status-report.md](./02-loan-status-report.md) | partial in dashboard |
| Loan Type Report | 🆕 | [02-loan-type-report.md](./02-loan-type-report.md) | — |
| Loan Maturity Report | 🆕 | [02-loan-maturity-report.md](./02-loan-maturity-report.md) | — |

### 03 — Collection Reports
| Report | Status | Spec | Existing code |
|---|---|---|---|
| Daily Collection | ✅ | [03-daily-collection.md](./03-daily-collection.md) | `app/api/v1/reports/daily/route.ts` |
| Date-wise Collection | ✅ | [03-date-wise-collection.md](./03-date-wise-collection.md) | `app/api/v1/analytics/collections/route.ts` |
| Agent-wise Collection | ✅ | [03-agent-wise-collection.md](./03-agent-wise-collection.md) | `app/api/v1/reports/agent/route.ts` |
| Area-wise Collection | 🆕 | [03-area-wise-collection.md](./03-area-wise-collection.md) | — |
| Customer Collection History | 🔧 | [03-customer-collection-history.md](./03-customer-collection-history.md) | loan statement |
| Collection Mode Report | 🆕 | [03-collection-mode-report.md](./03-collection-mode-report.md) | — |
| Missed Collection Report | 🔧 | [03-missed-collection-report.md](./03-missed-collection-report.md) | defaulter alerts |
| Partial Payment Report | 🆕 | [03-partial-payment-report.md](./03-partial-payment-report.md) | — |
| Advance Payment Report | 🆕 | [03-advance-payment-report.md](./03-advance-payment-report.md) | — |

### 04 — Overdue Reports
| Report | Status | Spec | Existing code |
|---|---|---|---|
| Overdue Summary | ✅ | [04-overdue-summary.md](./04-overdue-summary.md) | `app/api/v1/reports/overdue/route.ts` |
| Aging Report (6 buckets) | 🔧 | [04-aging-report.md](./04-aging-report.md) | 3-bucket in `lib/reports/data.ts:68` |
| High Risk Customers | 🆕 | [04-high-risk-customers.md](./04-high-risk-customers.md) | — |
| Chronic Defaulters | 🆕 | [04-chronic-defaulters.md](./04-chronic-defaulters.md) | — |

### 05 — EMI Reports
| Report | Status | Spec | Existing code |
|---|---|---|---|
| EMI Schedule Report | 🔧 | [05-emi-schedule-report.md](./05-emi-schedule-report.md) | `loans/[id]/instalments` |
| Upcoming EMI Report | 🆕 | [05-upcoming-emi-report.md](./05-upcoming-emi-report.md) | — |
| Today's EMI Report | 🔧 | [05-todays-emi-report.md](./05-todays-emi-report.md) | collection dashboard |

### 06 — Customer Reports
| Report | Status | Spec | Existing code |
|---|---|---|---|
| Customer Register | 🔧 | [06-customer-register.md](./06-customer-register.md) | `customers` list |
| Customer Loan History | ✅ | [06-customer-loan-history.md](./06-customer-loan-history.md) | `customers/[id]/loans` |
| Repeat Borrowers | 🆕 | [06-repeat-borrowers.md](./06-repeat-borrowers.md) | — |
| Inactive Customers | 🆕 | [06-inactive-customers.md](./06-inactive-customers.md) | — |
| Top Borrowers | 🆕 | [06-top-borrowers.md](./06-top-borrowers.md) | — |

### 07 — Agent Reports
| Report | Status | Spec | Existing code |
|---|---|---|---|
| Agent Performance | ✅ | [07-agent-performance.md](./07-agent-performance.md) | `analytics/agents` |
| Agent Attendance | 🆕 | [07-agent-attendance.md](./07-agent-attendance.md) | — |
| GPS Route Report | ✅ | [07-gps-route-report.md](./07-gps-route-report.md) | `gps/history/[id]` |
| Missed Visit Report | 🆕 | [07-missed-visit-report.md](./07-missed-visit-report.md) | — |
| Collection Efficiency | ✅ | [07-collection-efficiency-report.md](./07-collection-efficiency-report.md) | `app/api/reports/route.ts` |
| Commission Report | 🆕 | [07-commission-report.md](./07-commission-report.md) | — |

### 08 — Financial Reports
| Report | Status | Spec | Existing code |
|---|---|---|---|
| Cash Flow Report | ✅ | [08-cash-flow-report.md](./08-cash-flow-report.md) | `accounting/cashflow` |
| Disbursement Report | ✅ | [08-disbursement-report.md](./08-disbursement-report.md) | `app/api/reports/route.ts` |
| Interest Income Report | 🆕 | [08-interest-income-report.md](./08-interest-income-report.md) | — |
| Penalty Income Report | ✅ | [08-penalty-income-report.md](./08-penalty-income-report.md) | `app/api/reports/route.ts` |
| Outstanding Balance Report | 🆕 | [08-outstanding-balance-report.md](./08-outstanding-balance-report.md) | dashboard partial |
| Profit Report | ✅ | [08-profit-report.md](./08-profit-report.md) | `accounting/pnl` |

### 09 — Branch Reports
| Report | Status | Spec | Existing code |
|---|---|---|---|
| Branch Performance | 🆕 | [09-branch-performance.md](./09-branch-performance.md) | — |
| Branch Comparison | 🆕 | [09-branch-comparison.md](./09-branch-comparison.md) | — |

### 10 — GPS Reports
| Report | Status | Spec | Existing code |
|---|---|---|---|
| Agent Live Location | ✅ | [10-agent-live-location.md](./10-agent-live-location.md) | `gps/live` |
| Travel Distance | 🔧 | [10-travel-distance.md](./10-travel-distance.md) | `gps/history` |
| Customer Visit History | 🔧 | [10-customer-visit-history.md](./10-customer-visit-history.md) | `gps/agent/[id]/collections` |
| Missed GPS Check-in | 🆕 | [10-missed-gps-checkin.md](./10-missed-gps-checkin.md) | — |

### 11 — Notification Reports
| Report | Status | Spec | Existing code |
|---|---|---|---|
| Notification Report (channel+status filters) | 🆕 | [11-notification-report.md](./11-notification-report.md) | `NotificationLog` model |

### 12 — Audit Reports
| Report | Status | Spec | Existing code |
|---|---|---|---|
| Audit Activity Report | 🆕 | [12-audit-activity-report.md](./12-audit-activity-report.md) | `AuditLog` model |
| Login History Report | 🆕 | [12-login-history-report.md](./12-login-history-report.md) | — |

### 13 — Payment Reports
| Report | Status | Spec | Existing code |
|---|---|---|---|
| Payment by Mode | 🆕 | [13-payment-by-mode.md](./13-payment-by-mode.md) | mode in data |
| Failed Payments | 🆕 | [13-failed-payments.md](./13-failed-payments.md) | — |
| Refund Report | 🆕 | [13-refund-report.md](./13-refund-report.md) | — |
| Duplicate Payments | 🆕 | [13-duplicate-payments.md](./13-duplicate-payments.md) | — |
| Cancelled Payments | 🆕 | [13-cancelled-payments.md](./13-cancelled-payments.md) | — |

### 14 — Tax & Accounting Reports
| Report | Status | Spec | Existing code |
|---|---|---|---|
| GST Report | ✅ | [14-gst-report.md](./14-gst-report.md) | `accounting/export/gstr1` |
| Income Statement | ✅ | [14-income-statement.md](./14-income-statement.md) | `accounting/pnl` |
| Ledger Report | 🔧 | [14-ledger-report.md](./14-ledger-report.md) | `accounting/journal` |
| Day Book | 🆕 | [14-day-book.md](./14-day-book.md) | — |
| Cash Book | 🆕 | [14-cash-book.md](./14-cash-book.md) | — |
| Bank Book | 🔧 | [14-bank-book.md](./14-bank-book.md) | `accounting/bank-rec` |
| Journal Report | ✅ | [14-journal-report.md](./14-journal-report.md) | `accounting/journal` |
| Trial Balance | ✅ | [14-trial-balance.md](./14-trial-balance.md) | `accounting/trial-balance` |

### 15 — Module Reports (our verticals) 💎
| Report | Status | Spec | Existing code |
|---|---|---|---|
| Gold Pledge Register | 🆕💎 | [15-gold-pledge-register.md](./15-gold-pledge-register.md) | `gold/reports?type=summary` |
| Gold Maturity & Auction | 🆕💎 | [15-gold-maturity-auction.md](./15-gold-maturity-auction.md) | — |
| Gold Released / Redeemed | 🆕💎 | [15-gold-released-redeemed.md](./15-gold-released-redeemed.md) | — |
| Gold Bank-Repledge Report | 🆕💎 | [15-gold-bank-repledge-report.md](./15-gold-bank-repledge-report.md) | `BankRepledge` model |
| Property Collateral Register | 🆕💎 | [15-property-collateral-register.md](./15-property-collateral-register.md) | — |
| Property Mortgage Status | 🆕💎 | [15-property-mortgage-status.md](./15-property-mortgage-status.md) | — |
| Product Finance Register | 🆕💎 | [15-product-finance-register.md](./15-product-finance-register.md) | — |
| Product Repossession Report | 🆕💎 | [15-product-repossession-report.md](./15-product-repossession-report.md) | — |
| Chit Group Report | 🆕💎 | [15-chit-group-report.md](./15-chit-group-report.md) | `chits` model |
| Chit Auction Report | 🆕💎 | [15-chit-auction-report.md](./15-chit-auction-report.md) | — |
| Chit Subscription Due | 🆕💎 | [15-chit-subscription-due.md](./15-chit-subscription-due.md) | — |
| Wallet Float Ledger | 🆕💎 | [15-wallet-float-ledger.md](./15-wallet-float-ledger.md) | `wallet/*` |
| NPA Classification Report | ✅💎 | [15-npa-classification-report.md](./15-npa-classification-report.md) | `npa/summary` |

### 16 — Dashboard Charts
| Spec | Status | File |
|---|---|---|
| 15 visualizations | 🆕 | [16-dashboard-charts.md](./16-dashboard-charts.md) |

---

## Build order (MVP-15 first)

1. **[`00-REPORT-FRAMEWORK.md`](./00-REPORT-FRAMEWORK.md)** — table-first shell + Excel/PDF/CSV engine + filter bar. *Unblocks everything.*
2. **MVP-15** (operator's recommended initial release):
   `16-dashboard-charts`, `02-loan-register`, `03-daily-collection`, `08-outstanding-balance-report`,
   `04-aging-report`, `06-customer-loan-history`, `05-emi-schedule-report`, `07-agent-performance`,
   `07-collection-efficiency-report`, `08-disbursement-report`, `08-interest-income-report`,
   `08-cash-flow-report`, `07-gps-route-report`, `12-audit-activity-report`, `13-payment-by-mode`.
3. **Remaining generic reports** — sections 02–14.
4. **Module reports** — section 15 (all read-only; ⚠️ only if a vertical needs an additive index).

---

## Export & filter capability (per operator requirement)

- **Every** report supports: **PDF · Excel · CSV · Print** (Email/WhatsApp share = phase 2, reuses
  the generated PDF). Defined once in the framework, not per report.
- **Universal filters** (each report enables the relevant subset): Date Range, Branch, Agent, Customer,
  Loan Type, Loan Status, Payment Status, Area/City/Village, Frequency, Amount Range, Interest Rate,
  Loan Officer, Collection Mode. All option lists come from the DB — never hardcoded.
