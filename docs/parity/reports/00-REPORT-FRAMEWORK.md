# 00 — Report Framework (shared shell, filter bar, export engine, charts)

> **The foundation.** Build this first. Every per-report spec references this file for the viewer shell,
> the universal filter bar, and the PDF/Excel/CSV/Print export engine — so the per-report docs stay thin
> and there is exactly **one** implementation of each shared mechanic.

---

## 0. Design contract (the promise to the operator)

1. **Table on screen first.** User applies filters → sees the result **table** rendered in the page.
   Export buttons appear above the table. No "download to view" — the screen is the source of truth.
2. **Export = exact screen columns.** PDF/Excel/CSV reproduce the *same* columns, in the *same* order,
   with the *same* totals row the user sees. One column definition drives screen + all three exports.
3. **One filter bar, data-driven.** All filters and their option lists come from the DB. No hardcoded
   enum lists in the component.
4. **Read-only, scoped, no-hardcode** — per the Strict Rules in [README.md](./README.md).

---

## 1. The column definition (single source for screen + exports)

Each report declares its columns **once**. Screen render, CSV, Excel, and PDF all consume this array.

```ts
// lib/reports/types.ts  (NEW — additive, no core touch)
export type ReportColumn = {
  key: string;                 // row field name
  label: string;               // i18n key, e.g. 'reports.col.loanCode'
  align?: 'left' | 'right' | 'center';
  type?: 'text' | 'number' | 'currency' | 'date' | 'percent' | 'badge';
  total?: boolean;             // include in footer total row (numbers/currency only)
  width?: number;              // PDF/Excel column width hint
};

export type ReportPayload = {
  title: string;               // i18n key
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  totals?: Record<string, number>;   // server-computed footer
  kpis?: { label: string; value: string | number; tone?: 'good'|'warn'|'bad' }[];
  meta: { from?: string; to?: string; branchName?: string; appName?: string; currencySymbol: string };
};
```

> **Why server-computed totals.** Footer sums come from the API (`_sum` via Prisma), not re-summed in the
> browser — keeps screen and export identical and avoids float drift.

---

## 2. `<ReportShell>` — the table-first viewer

```
components/reports/ReportShell.tsx   (NEW)
```

Responsibilities:
- Render the **FilterBar** (section 3) at top.
- On Apply → fetch `GET /api/v1/reports/<slug>?<filters>` → receive `ReportPayload`.
- Render **KPI cards** (if `kpis` present) then the **export button row** then the **data table** then the **totals footer**.
- Each export button hits `GET /api/v1/reports/<slug>/export?format=pdf|excel|csv&<same filters>` and triggers a browser download. **Print** = `window.print()` against a print-stylesheet that hides chrome.
- Loading / empty / error states. Pagination via `pagination.nextCursor` (cursor pattern already in `Envelope`).

Layout (ASCII):
```
┌───────────────────────────────────────────────┐
│ [Date ▾] [Branch ▾] [Agent ▾] [Status ▾] [Apply]│  ← FilterBar
├───────────────────────────────────────────────┤
│ [KPI] [KPI] [KPI] [KPI]                         │  ← optional
│            [PDF] [Excel] [CSV] [Print]          │  ← export row
├───────────────────────────────────────────────┤
│ Col A │ Col B │ Col C │ ...        (TABLE FIRST) │
│  ...  │  ...  │  ...  │                          │
│ TOTAL │       │  Σ    │                          │  ← totals footer
└───────────────────────────────────────────────┘
```

Reuse the existing styling/markup conventions from `app/(dashboard)/[module]/reports/ReportsClient.tsx`
(filter form, export buttons, KPI cards, table) — generalize, do not fork.

---

## 3. Universal Filter Bar (data-driven, no hardcode)

```
components/reports/FilterBar.tsx     (NEW)
```

Each report passes the subset of filters it supports. **Every option list is fetched from the DB**, never
hardcoded:

| Filter | Option source | Notes |
|---|---|---|
| Date Range | presets (Today/Week/Month/Custom) + ISO `from`/`to` | midnight-normalize server-side (`app/api/v1/reports/agent/route.ts:14`) |
| Branch | `prisma.branch.findMany` (scoped) | hidden for single-branch tenants |
| Agent / Loan Officer | `prisma.user.findMany({ role:'agent' })` (scoped) | — |
| Customer | typeahead → `customers` API | — |
| Loan Type | distinct `loan.loanType` for tenant | from data, not a constant |
| Loan Status | distinct `loan.status` | active/overdue/closed/… from data |
| Payment Status | instalment status set | upcoming/paid/partial/missed |
| Area / City / Village | `route`/area `AppSetting` keys | route = `customer.routeId` |
| Frequency | distinct `loan.frequency` | daily/weekly/biweekly/monthly/… |
| Amount Range | numeric min/max | client→query params |
| Interest Rate | numeric min/max | — |
| Collection Mode | distinct `payment.paymentMode` | cash/upi/cheque/bank/… |

Filter values flow to the API as query params and into the **export** request unchanged, so the file
matches the screen exactly.

---

## 4. Export engine (additive — new files only)

### 4a. Excel — `lib/reports/excel.ts` (NEW; uses `exceljs` already in `package.json`)
```ts
import ExcelJS from 'exceljs';
import type { ReportPayload } from './types';

export async function toWorkbook(p: ReportPayload): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(p.title.slice(0, 31));
  // title + period meta rows, then header row from p.columns, then p.rows, then totals row.
  // number/currency cells get numFmt; freeze header; auto width from column.width.
  return Buffer.from(await wb.xlsx.writeBuffer());
}
```
Response: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
`Content-Disposition: attachment; filename="<slug>-<from>-to-<to>.xlsx"`.

### 4b. PDF — generalize `lib/reports/pdf.tsx`
Keep `CollectionReportPDF` working; **add** a generic `TableReportPDF({ payload }: { payload: ReportPayload })`
reusing the existing `StyleSheet` (`lib/reports/pdf.tsx:4-20`): header (appName/branch/title/period), optional
KPI grid, the column-driven table, totals footer, the existing "Generated by … Confidential" footer. Render
via `renderToBuffer` exactly like `app/api/reports/pdf/route.ts`.
> Tamil/Indic note: for reports that must print Tamil text, use the **printable-HTML** route style
> (`app/api/loans/[id]/gold-receipt/route.ts`) instead of react-pdf, to get native Indic shaping — flagged per report.

### 4c. CSV — `lib/reports/csv.ts` (NEW; extract the proven pattern)
Generalize the quote-escape + join used in `app/api/export/collections/route.ts:36-57` to take
`ReportColumn[]` + rows. Same `Content-Disposition` convention.

### 4d. The export route convention
```
app/api/v1/reports/[slug]/export/route.ts   (NEW, one route, format switch)
GET ?format=pdf|excel|csv & <same filters as the data endpoint>
```
It calls the **same builder** the data endpoint uses (so numbers match), then dispatches to
`toWorkbook` / `TableReportPDF` / csv. Subscription gate (`receiptPdfAllowed`) applies to PDF/Excel where
configured; CSV stays available to lighter plans (operator-configurable via `AppSetting`).

---

## 5. The data endpoint convention

```
app/api/v1/reports/<slug>/route.ts   (NEW per report)
```
- Auth: `requireMobileContext(req)` → `ctx`.
- `where = { tenantId: ctx.tenantId, ...appScope(ctx.appType), ...scopedBranchWhere(ctx), <filters> }`.
- Date range midnight-normalized; optional `agentId`/`routeId`/`branchId`/`customerId`.
- Aggregate via a **builder in `lib/reports/*`** (mirror `buildReportData()` — read-only).
- Return `ok(payload)` where `payload: ReportPayload`. Paginate large row sets via `nextCursor`.

> **Builders, not inline queries.** Each report's aggregation lives in `lib/reports/builders/<slug>.ts`
> so it can be unit-tested with seed data and reused by both the data endpoint and the export route.

---

## 6. Charts (for the dashboard-charts spec, §16)

Reuse Recharts already used in `app/(dashboard)/[module]/dashboard/CollectionTrendChart.tsx`. Each chart is
fed by a read-only aggregation endpoint (mostly existing analytics endpoints). The 15 visualizations are
enumerated in [16-dashboard-charts.md](./16-dashboard-charts.md). No new charting library.

---

## 7. i18n

Add a `reports` namespace expansion in `i18n/en.ts` (already has `reports.*` at `:801`): `reports.col.*`
for column labels, `reports.kpi.*`, `reports.filter.*`, plus a per-report title key. Mirror every key into
`ta/hi/te/kn/ml`. Screen and export both read labels through `getDictionary(tenantId)` — exports are
localized to the tenant's language.

---

## 8. RBAC & subscription

- Agents: scoped to own customers/branch (already enforced by `scopedBranchWhere`); some reports (financial,
  audit, accounting) are **admin+ only** — gate with role check like `app/api/export/collections/route.ts:9`.
- PDF/Excel export gated by `receiptPdfAllowed`; premium accounting reports by `isPremiumAccountingEnabled`.
- All gates are **read flags** — no new permission columns.

---

## 9. ⚠️ Structure-Impact (framework)

| Change | Type | Sign-off? |
|---|---|---|
| `components/reports/ReportShell.tsx`, `FilterBar.tsx` | NEW UI | No |
| `lib/reports/types.ts`, `excel.ts`, `csv.ts`, `builders/*` | NEW lib | No |
| `TableReportPDF` added to `lib/reports/pdf.tsx` | additive export | No |
| `app/api/v1/reports/<slug>/route.ts`, `.../export/route.ts` | NEW routes | No |
| `reports.*` i18n keys (6 langs) | additive | No |
| Any **additive index** on an existing table for report perf | schema | **YES** — gated SQL in `docs/parity/migrations/`, never auto-applied |
| Any **new column / model** | schema | **YES** — must be justified; default is "not needed, reports are read-only" |

**No edits** to loan/payment/instalment/penalty/gold/accounting write paths. Reports never mutate.

---

## 10. Test plan (framework)

1. Unit-test one builder against seed data → assert KPI + totals.
2. `toWorkbook` / `TableReportPDF` / csv produce files that open in Excel / a PDF viewer and the **totals
   match the screen**.
3. Scope test: agent token sees only own rows; superadmin sees tenant; cross-module isolation holds
   (a `goldloan` report shows zero `microlending` rows).
4. i18n test: switch tenant language → headers + export localized.
