# 05 · Upcoming EMI Report

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Instalments **falling due in the next 7 / 15 / 30 days** — the forward collection pipeline. Lets agents and
managers plan routes and cash needs.

## 2. Source models (READ ONLY)
- `Instalment` (`:529`): `dueDate` in future window, `status='upcoming'`, `dueAmount`, `agentId`.
- `Loan`, `Customer` (name, phone, route).
- Windows from `getSetting(tenantId,'report_upcoming_windows','7,15,30')`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Customer | `customerName` | text | left | |
| Loan No | `loanCode` | text | left | |
| Due Date | `dueDate` | date | center | |
| In (days) | `daysToDue` | number | right | |
| Amount | `dueAmount` | currency | right | ✓ |
| Window | `window` | badge | center | |
| Agent | `agentName` | text | left | |

`window` ∈ {≤7, ≤15, ≤30}.

## 4. KPI cards
Due next 7d · 15d · 30d (count + amount each).

## 5. Filters
Branch, Agent, Window, Route.

## 6. API contract
`GET /api/v1/reports/upcoming-emi?asOf?&branchId?&agentId?&window?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/upcoming-emi.ts`)
`findMany` upcoming instalments (scoped) with `dueDate` in `[asOf, asOf+maxWindow]`; classify by window;
sum amount.

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print. Filename `upcoming-emi-<asOf>`.

## 9. i18n keys
`reports.upcomingEmi.title`, `reports.window.d7|d15|d30`, `reports.col.daysToDue`.

## 10. RBAC + subscription
Agent sees own; admin tenant. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only `findMany`. Windows from `AppSetting`. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Windows from `AppSetting`. Currency/labels from DB/i18n.

## 13. Test plan
Seed upcoming instalments at +3/+10/+25 days → assert correct window; export totals match.
