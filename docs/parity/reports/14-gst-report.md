# 14 · GST Report

**Status:** ✅ EXISTS (wrap) · **Module scope:** all (premium accounting) · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
GST output/summary (GSTR-1 style) for tenants that charge GST on fees/services. Already implemented as a CSV
export; wrap into the table-first shell + add Excel/PDF.

## 2. Source models (READ ONLY)
- Existing `accounting/export/gstr1` + `GstSummary` model. `JournalLine` `taxCode`/`taxableAmount`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| GSTIN/Party | `party` | text | left | |
| Invoice/Ref | `ref` | text | left | |
| Taxable Value | `taxable` | currency | right | ✓ |
| CGST | `cgst` | currency | right | ✓ |
| SGST | `sgst` | currency | right | ✓ |
| IGST | `igst` | currency | right | ✓ |
| Total Tax | `totalTax` | currency | right | ✓ |

## 4. KPI cards
Taxable value · total GST · CGST/SGST/IGST split.

## 5. Filters
Month, Year (matches existing GSTR-1 params), Branch.

## 6. API contract
**Existing:** `GET /api/v1/accounting/export/gstr1?month&year&format=json|csv`. Add adapter → `ReportPayload`
for screen + Excel/PDF (CSV already exists).

## 7. Aggregation
Reuse existing GSTR-1 builder (no change). Adapter maps lines → rows.

## 8. Export mapping
7 columns → CSV (existing) / Excel / PDF / Print. Filename `GSTR1-<year>-<month>`.

## 9. i18n keys
`reports.gst.title`, `reports.col.party|ref|taxable|cgst|sgst|igst|totalTax`.

## 10. RBAC + subscription
Accountant+; gated by `isPremiumAccountingEnabled`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
No change to existing GSTR-1 logic. Adapter read-only/additive.

## 12. No-hardcode checklist
- [ ] Tax rates/codes from journal data, not constants. Currency/labels from DB/i18n.

## 13. Test plan
Seed taxed journal lines → assert GST split = existing export; screen/Excel/PDF match the CSV totals.
