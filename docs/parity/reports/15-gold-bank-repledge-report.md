# 15 · Gold Bank-Repledge Report 💎

**Status:** 🆕 NEW · **Module scope:** `goldloan` only · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Gold the pawn-broker has **re-pledged to a bank** for liquidity — which packets, to which bank, at what rate,
how much drawn. Tracks the broker's own borrowing against customer collateral.

## 2. Source models (READ ONLY)
- `BankRepledge` (`:1020`): `bankName`, `bankDate`, `referenceNo`, `amountGivenByBank`, `interestRate`,
  `processingFee`, `staffName`, `status`. `Loan`/`GoldLoanCollateral` for packet linkage.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Bank | `bankName` | text | left | |
| Ref No | `referenceNo` | text | left | |
| Date | `bankDate` | date | center | |
| Packet/Loan | `loanCode` | text | left | |
| Amount from Bank | `amountGivenByBank` | currency | right | ✓ |
| Interest Rate | `interestRate` | percent | right | |
| Processing Fee | `processingFee` | currency | right | ✓ |
| Status | `status` | badge | center | |

## 4. KPI cards
Active repledges · total drawn from banks · avg interest rate · fees paid.

## 5. Filters
Date range, Bank, Status.

## 6. API contract
`GET /api/v1/reports/gold-bank-repledge?from&to&bank?&status?` → `ok(payload)`. May reuse existing
`gold/loans/[id]/repledge` data aggregated tenant-wide.

## 7. Aggregation (builder `lib/reports/builders/gold-bank-repledge.ts`)
`findMany` `BankRepledge` (scoped via loan→tenant/appType) in range; join loan/packet; group banks for KPI.

## 8. Export mapping
8 columns → CSV/Excel/PDF/Print. Filename `gold-bank-repledge-<from>-to-<to>`.

## 9. i18n keys
`reports.goldBankRepledge.title`, `reports.col.bank|refNo|amountFromBank|interestRate|processingFee`.

## 10. RBAC + subscription
Gold owner/admin only (broker finance). Module gate `goldloan`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only over `BankRepledge`. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Bank list from master data/`BankName`. Currency/labels from DB/i18n.

## 13. Test plan
Seed repledge records → assert listing + total drawn/fees; filter by bank/status; export matches.
