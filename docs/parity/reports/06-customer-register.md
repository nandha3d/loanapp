# 06 · Customer Register

**Status:** 🔧 ENHANCE · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Master directory of all customers with KYC/contact, guarantor, loan count and outstanding. The "who are my
borrowers" reference. Customer list exists; this adds register columns + export.

## 2. Source models (READ ONLY)
- `Customer` (`:283`): `customerCode`, `name`, `phone`, address, `aadhaar*`/kyc fields, `agentId`, `routeId`,
  `status`, guarantor fields. `Loan` (count + outstanding per customer).

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Code | `customerCode` | text | left | |
| Name | `name` | text | left | |
| Phone | `phone` | text | left | |
| Address | `address` | text | left | |
| Aadhaar (masked) | `aadhaarMasked` | text | left | |
| Guarantor | `guarantor` | text | left | |
| Loans | `loanCount` | number | right | ✓ |
| Outstanding | `outstanding` | currency | right | ✓ |
| Status | `status` | badge | center | |

Aadhaar **masked** (last 4) in screen + export — PII rule, masking from existing customer display helper.

## 4. KPI cards
Total customers · active · with-outstanding · KYC-verified %.

## 5. Filters
Branch, Agent, Route, Status, KYC status.

## 6. API contract
`GET /api/v1/reports/customer-register?branchId?&agentId?&routeId?&status?&kycStatus?&cursor?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/customer-register.ts`)
`findMany` customers (scoped) with `_count` loans + outstanding via grouped loan sums; mask Aadhaar.

## 8. Export mapping
9 columns → CSV/Excel/PDF/Print. Aadhaar stays masked in exports. Filename `customer-register-<date>`.

## 9. i18n keys
`reports.customerRegister.title`, `reports.col.code|name|phone|address|aadhaar|guarantor|loans|outstanding`.

## 10. RBAC + subscription
Agent sees own customers; admin tenant. PII columns admin-only via role flag. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Masking via existing helper. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Status/KYC options from distinct. Masking from helper, not inline. Labels/currency from DB/i18n.

## 13. Test plan
Seed customers with loans → assert loanCount/outstanding; Aadhaar masked; scope; export matches.
