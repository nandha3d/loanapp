# 15 · NPA Classification Report 💎

**Status:** ✅ EXISTS (wrap) · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Loans classified as Non-Performing Assets by aging category, with provisioning — the RBI-style asset-quality
report. `npa/summary|loans|history` exist; wrap into the shell + add Excel/PDF.

## 2. Source models (READ ONLY)
- Existing `npa/summary`, `npa/loans`. `Loan` (`:444`) `npaStatus`, `npaDaysOverdue`, `provisioningRate`,
  `provisioningAmount`, `provisioningCategory`. `LoanProvisioning` snapshots. `NpaHistory` transitions.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Loan No | `loanCode` | text | left | |
| Customer | `customerName` | text | left | |
| Days Overdue | `npaDaysOverdue` | number | right | |
| Category | `provisioningCategory` | badge | center | |
| Outstanding | `outstanding` | currency | right | ✓ |
| Provisioning % | `provisioningRate` | percent | right | |
| Provision Amount | `provisioningAmount` | currency | right | ✓ |
| Secured? | `isSecured` | badge | center | |

Summary view: one row per category (Standard/Sub-standard/Doubtful/Loss) with count + outstanding + provision.

## 4. KPI cards
NPA count · gross NPA · provision required · NPA ratio %.

## 5. Filters
As-of date, Branch, Category.

## 6. API contract
**Existing:** `GET /api/v1/npa/summary?date`, `GET /api/v1/npa/loans?category&page`. Add adapter →
`ReportPayload` (summary + drill-down).

## 7. Aggregation
Reuse existing NPA services (`getNpaSummary`, `listNpaLoans`) — **no change**. Adapter maps to columns.

## 8. Export mapping
8 columns → CSV/Excel/PDF/Print. Filename `npa-classification-<asOf>`.

## 9. i18n keys
`reports.npaClassification.title`, `reports.col.daysOverdue|category|provisioningRate|provisionAmount|secured`.

## 10. RBAC + subscription
Admin/owner/compliance. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
No change to NPA classification engine. Adapter read-only/additive — no reclassification from report.

## 12. No-hardcode checklist
- [ ] Categories + provisioning rates from existing NPA config, not constants. Currency/labels from DB/i18n.

## 13. Test plan
Seed loans across NPA buckets → assert category counts + provisioning = existing services; export matches.
