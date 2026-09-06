# 14 · Trial Balance

**Status:** ✅ EXISTS (wrap) · **Module scope:** all (premium accounting) · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Debit/credit balance of every ledger account as of a date — must balance (ΣDr = ΣCr). The accountant's
period-close check. `accounting/trial-balance` exists; wrap + add Excel/PDF.

## 2. Source models (READ ONLY)
- Existing `accounting/trial-balance`: `rows=[{code,name,classType,debit,credit}]`, `totalDebit`, `totalCredit`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Code | `code` | text | left | |
| Account | `name` | text | left | |
| Class | `classType` | badge | center | |
| Debit | `debit` | currency | right | ✓ |
| Credit | `credit` | currency | right | ✓ |

Footer asserts ΣDebit == ΣCredit (visual balance check).

## 4. KPI cards
Total debit · total credit · balanced? (✓/✗) · account count.

## 5. Filters
As-of date, Branch.

## 6. API contract
**Existing:** `GET /api/v1/accounting/trial-balance?asOf`. Add adapter → `ReportPayload`.

## 7. Aggregation
Reuse existing trial-balance (no change). Adapter maps rows; flags balance.

## 8. Export mapping
5 columns + balance footer → CSV/Excel/PDF/Print. Filename `trial-balance-<asOf>`.

## 9. i18n keys
`reports.trialBalance.title`, `reports.col.code|account|class|debit|credit`, `reports.balanced`.

## 10. RBAC + subscription
Accountant+; premium gated. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
No change to existing endpoint. Adapter read-only/additive.

## 12. No-hardcode checklist
- [ ] Account classes from COA. Currency/labels from DB/i18n.

## 13. Test plan
Post balanced journals → assert ΣDr == ΣCr; adapter == endpoint; export matches.
