# LoanTrack — Audit Fix Tracker

> Source: `docs/audit-report-2026-06-10.html`  
> Each file below is a self-contained instruction set for an AI coding agent.

## Security

| ID | File | Priority | Status |
|----|------|----------|--------|
| [SEC-01](SEC-01-delete-npa-shadow-routes.md) | Delete `/api/npa/*` shadow routes (dup of `/api/v1/npa/*`) | 🔴 HIGH | DONE |
| [SEC-02](SEC-02-rate-limit-forgot-password.md) | Rate-limit `POST /api/v1/auth/forgot-password` | 🔴 HIGH | DONE |
| [SEC-03](SEC-03-collection-entry-zod.md) | Zod validation on web collection-entry route | 🟠 HIGH | DONE |
| [SEC-04](SEC-04-digio-webhook-hmac.md) | Fix `timingSafeEqual` length crash in Digio webhook | 🟠 HIGH | DONE |

## Performance

| ID | File | Priority | Status |
|----|------|----------|--------|
| [PERF-01](PERF-01-pagination-cap.md) | Cap all unbounded list endpoints at `pageSize ≤ 200` | 🟠 HIGH | DONE |
| [PERF-02](PERF-02-db-indexes-nach.md) | Add DB indexes on NACH + collection tables | 🟠 HIGH | DONE |
| [PERF-03](PERF-03-cache-appsetting.md) | Cache `AppSetting` + subscription status reads (in-process) | 🟡 MEDIUM | DONE |
| [PERF-04](PERF-04-gps-live-query.md) | Fix GPS live endpoint: add time filter + raw SQL for latest-ping | 🟠 HIGH | DONE |

## Hardcoded Values

| ID | File | Priority | Status |
|----|------|----------|--------|
| [HARD-01](HARD-01-currency-symbol.md) | Replace `"₹"` hardcode with `AppSetting.currency_symbol` | 🟠 HIGH | DONE |
| [HARD-02](HARD-02-fiscal-year-start.md) | Read fiscal-year start month from tenant `AppSetting` | 🟠 HIGH | DONE |
| [HARD-03](HARD-03-account-codes.md) | Read GL account codes from `accountingSettings.postingOverrides` | 🟠 HIGH | DONE |
| [HARD-04](HARD-04-brand-name.md) | Replace `"LoanTrack"` brand from `AppSetting.brand_name` | 🟡 MEDIUM | DONE |
| [HARD-05](HARD-05-nach-config.md) | NACH retry days / max retries / horizon → `AppSetting` keys | 🟡 MEDIUM | DONE |

## Feature Gaps

| ID | File | Priority | Status |
|----|------|----------|--------|
| [FEAT-01](FEAT-01-tally-xml-sync.md) | Tally XML export: `voucherType` field + `lib/accounting/tallyExport.ts` | 🟠 HIGH | DONE |
| [FEAT-02](FEAT-02-aged-receivables.md) | Customer subledger + aged-receivables report | 🟡 MEDIUM | DONE |
| [FEAT-03](FEAT-03-mobile-accounting.md) | Mobile: read-only accounting UI (JE list + CoA + trial balance) | 🔴 HIGH | BACKEND DONE — Flutter UI pending |
| [FEAT-04](FEAT-04-mobile-enach.md) | Mobile: e-NACH mandate registration screen | 🔴 HIGH | BACKEND DONE — Flutter UI pending |
| [FEAT-05](FEAT-05-gst-export.md) | GST GSTR-1 / GSTR-3B export format | 🟡 MEDIUM | DONE |

## Code Quality

| ID | File | Priority | Status |
|----|------|----------|--------|
| [QUAL-01](QUAL-01-unit-tests.md) | Unit tests for `loanCalculator.ts` and `repayments.ts` | 🟡 MEDIUM | DONE |
