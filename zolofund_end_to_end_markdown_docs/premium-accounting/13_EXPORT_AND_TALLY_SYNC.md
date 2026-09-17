# 13 · Export & Tally Sync

> Export accounting data to Tally Prime XML, Excel, JSON for backup, audit, or hand-off to the tenant's CA.

---

## 1. Purpose

- Tally Prime XML export of: Chart of Accounts, Vouchers (journal entries), Bills, Payments. Importable via Tally's "XML Data" → "Import" menu.
- Excel workbook export bundling P&L, Balance Sheet, Trial Balance, Cash Flow, GSTR-3B summary, Journal book for a period.
- JSON dump of all premium-accounting tables (for archival).
- Optional **Tally Connector** (Tally's HTTP server on `localhost:9000`) for direct sync (push-only, v2).

---

## 2. Route & access

| | |
|---|---|
| **Route** | `/<module>/accounting/premium/export` |
| **File** | `app/(dashboard)/[module]/accounting/premium/export/page.tsx` |
| **Client** | `app/(dashboard)/[module]/accounting/premium/export/ExportClient.tsx` |
| **Actions** | `app/(dashboard)/[module]/accounting/premium/export/actions.ts` |
| **Role gate** | `superadmin` / `developer` (exports include all books) |
| **Subscription gate** | `premiumAccountingEnabled` |

---

## 3. UI

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Premium > Export                                                         │
├──────────────────────────────────────────────────────────────────────────┤
│ Period: [01-May-26] – [31-May-26]   Branch: [All ▾]                      │
│                                                                          │
│ ☑ Tally XML                                                              │
│   Includes: Chart of Accounts, Vouchers, Bills, Payments                 │
│   [⇩ Download tally-may-2026.xml]                                        │
│                                                                          │
│ ☑ Excel workbook                                                         │
│   Sheets: P&L, Balance Sheet, Trial Balance, Cash Flow, GSTR-3B, Journal │
│   [⇩ Download accounting-may-2026.xlsx]                                  │
│                                                                          │
│ ☑ Full JSON dump (raw schema)                                            │
│   [⇩ Download accounting-snapshot-2026-05-31.json]                       │
│                                                                          │
│ ─── Tally Connector (advanced) ───────────────────────────────────────── │
│ Connector URL: [http://localhost:9000      ]                              │
│ Company:       [ZoloFund Books            ]                              │
│ [Test connection]  [Push vouchers]                                       │
│                                                                          │
│ ─── Recent exports ─────────────────────────────────────────────────────  │
│ 21-May 14:00  Excel workbook  May 2026   superadmin   ⇩ re-download      │
│ 20-May 17:30  Tally XML       Apr 2026   superadmin   ⇩ re-download      │
└──────────────────────────────────────────────────────────────────────────┘
```

Recent-exports list reads from a small table `accounting_export_runs` (id, tenantId, kind, periodKey, branchId, filename, fileSize, byUserId, createdAt). File blobs stored under `storage/accounting/exports/<id>/<filename>` (max retention 90 days; vacuum cron).

---

## 4. Tally XML format

Tally accepts an `<ENVELOPE>` root with `<HEADER>` + `<BODY>` containing `<DATA>` → list of `<TALLYMESSAGE>` nodes. Voucher-creating example:

```xml
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>ZoloFund Books</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE>
          <VOUCHER VCHTYPE="Journal" ACTION="Create">
            <DATE>20260521</DATE>
            <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
            <VOUCHERNUMBER>JE-2026-0421</VOUCHERNUMBER>
            <NARRATION>Salary May</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Salaries &amp; Wages</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-80000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>HDFC Current Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>80000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
        ...
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
```

### Mappings

- ZoloFund `Account.classType + subType` → Tally Group.
  - `asset:cash` → `Cash-in-Hand`
  - `asset:bank` → `Bank Accounts`
  - `asset:receivable` → `Sundry Debtors`
  - `asset:fixed_asset` → `Fixed Assets`
  - `liability:payable` → `Sundry Creditors`
  - `liability:tax` → `Duties & Taxes`
  - `equity:capital` → `Capital Account`
  - `equity:reserves` → `Reserves & Surplus`
  - `income:operating_income` → `Direct Incomes`
  - `income:other_income` → `Indirect Incomes`
  - `expense:operating_expense` → `Indirect Expenses`
  - `expense:depreciation` → `Indirect Expenses`
- ZoloFund JE → Tally Journal voucher.
- ZoloFund Bill → Tally Purchase voucher (`VCHTYPE="Purchase"`).
- ZoloFund Payment → Tally Payment voucher.
- TDS deductions appear as separate ledger lines inside the Payment voucher.

`lib/accounting/exporters/tallyXml.ts` builds the XML using a streaming writer to handle large data sets (≥ 100k vouchers).

### Date format

Tally expects `YYYYMMDD` strings. The exporter coerces all dates accordingly.

### Encoding

UTF-8 with BOM. Includes `<?xml version="1.0" encoding="utf-8"?>`. Special characters in narrations escaped.

---

## 5. Excel workbook

Built with `xlsx`. One sheet per artifact, plus a cover sheet:

| Sheet | Content |
|---|---|
| Cover | Tenant name, GSTIN, period, generation timestamp, signature placeholder |
| P&L | Same rendering as P&L page (summary mode) |
| Balance Sheet | Same as BS page |
| Trial Balance | 2-col view |
| Cash Flow | Direct method |
| GSTR-3B | Section figures (output, input, net, liability) |
| GSTR-1 (summary) | B2C, Nil, HSN summary |
| Journal Book | One row per JE line with entryNo, date, account, Dr, Cr, narration |

Each sheet has frozen header row, autosized columns, currency formatting `#,##,##0.00` (Indian).

---

## 6. Full JSON dump

Single JSON file with shape:

```json
{
  "meta": {
    "tenantId": "...",
    "tenantName": "ABC Microfinance",
    "branchId": "..." | "all",
    "fromDate": "2026-05-01",
    "toDate": "2026-05-31",
    "exportedAt": "2026-05-21T14:00:00Z",
    "exportedBy": { "id": "...", "name": "John" },
    "schemaVersion": 1
  },
  "accounts": [ ... ],
  "journalEntries": [ ... ],          // includes lines
  "bills": [ ... ],
  "vendors": [ ... ],
  "tdsDeductions": [ ... ],
  "gstSummaries": [ ... ],
  "bankAccounts": [ ... ],
  "bankStatements": [ ... ],          // includes lines and matched journalLineId
  "budgets": [ ... ],
  "periods": [ ... ],
  "auditLog": [ ... ]                 // log entries in range
}
```

Pretty-printed (2-space). Large dumps streamed; gzipped if > 5 MB.

A companion `lib/accounting/importers/jsonDump.ts` can re-import into a fresh tenant — used for migrating between environments.

---

## 7. Tally connector (advanced, v2)

Tally Prime exposes an XML/HTTP server on `:9000` if "ODBC Server" is enabled. Connector pushes vouchers directly:

```ts
const xml = buildTallyVouchersXml({ tenantId, periodKey });
const res = await fetch(`${connectorUrl}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/xml' },
  body: xml,
});
const text = await res.text();
const result = parseTallyResponse(text);   // { created, ignored, errors }
```

Connector URL is stored in `accountingSettings.tallyConnectorUrl`. `[Test connection]` button calls Tally's `<TALLYREQUEST>Export Data</TALLYREQUEST>` with a `Company` report to validate.

**Caveats:** Tally must be running on a machine reachable from the ZoloFund server. For most tenants this is a local-network setup; we surface a warning that the connector is **not** for cloud deployments.

---

## 8. Server actions

```ts
export async function exportTallyXml(periodKey: string, branchId?: string | null): Promise<File>;
export async function exportExcelWorkbook(periodKey: string, branchId?: string | null): Promise<File>;
export async function exportJsonDump(from: string, to: string, branchId?: string | null): Promise<File>;

export async function testTallyConnector(url: string): Promise<{ ok: boolean; company?: string; error?: string }>;
export async function pushToTally(periodKey: string): Promise<{ created: number; ignored: number; errors: string[] }>;

export async function listExportRuns(filter: ExportFilter): Promise<ExportRun[]>;
export async function downloadExportRun(id: string): Promise<File>;
```

---

## 9. i18n (`pa.export`)

```ts
pa: {
  export: {
    title: 'Export',
    period: 'Period',
    branch: 'Branch',
    tallyXmlTitle: 'Tally XML',
    tallyXmlIncludes: 'Includes: Chart of Accounts, Vouchers, Bills, Payments',
    excelWorkbookTitle: 'Excel workbook',
    excelSheets: 'Sheets: P&L, Balance Sheet, Trial Balance, Cash Flow, GSTR-3B, Journal',
    jsonDumpTitle: 'Full JSON dump (raw schema)',
    downloadBtn: '⇩ Download {file}',
    connectorTitle: 'Tally Connector (advanced)',
    connectorUrl: 'Connector URL',
    company: 'Company',
    testConnection: 'Test connection',
    pushVouchers: 'Push vouchers',
    recentExports: 'Recent exports',
    reDownload: '⇩ re-download',
    connectorWarn: 'The Tally Connector requires Tally Prime running on a reachable host. Not suitable for cloud installs.',
  },
}
```

---

## 10. Edge cases

| Case | Behaviour |
|---|---|
| Period > 1 month requested | Allowed but file may be large; show spinner with size estimate |
| 200k+ journal lines | Excel limited to 1,048,576 rows per sheet; Journal Book sheet splits into `Journal Book 1`, `Journal Book 2`, ... |
| Special chars in account names (e.g., `&`, `<`, `>`) | XML escaped |
| Tally connector unreachable | Test returns `ok=false` with error string; push button disabled |
| Account class with no Tally mapping (custom subType) | Falls back to `Indirect Expenses` for expense, `Indirect Incomes` for income, with warning |
| Voucher amount = 0 | Skipped (Tally rejects zero vouchers) |
| Tenant has no closed period yet | Allowed; export reflects mid-period state |
| Re-download expired export | `404` with toast "Export file no longer available (90-day retention)" |
| Branch filter requested but JEs cross branches | Export only for that branch's lines |

---

## 11. Test scenarios

| ID | Scenario | Expected |
|---|---|---|
| EXP-01 | Tally XML for 50 JEs | XML validates against Tally schema (xmllint --noout) |
| EXP-02 | Tally XML imports cleanly in Tally Prime sandbox | All vouchers appear |
| EXP-03 | Excel workbook for current month | Opens in LibreOffice without warnings |
| EXP-04 | JSON dump for 1-day window | File contains expected entities |
| EXP-05 | Tally connector test on valid URL | `{ok: true, company: 'ZoloFund Books'}` |
| EXP-06 | Tally connector on unreachable URL | `{ok:false, error:'ECONNREFUSED'}` |
| EXP-07 | Push 100 vouchers to Tally | All `created`, none `ignored` |
| EXP-08 | Excel with 1.2M journal lines | Sheets split, no crash |
| EXP-09 | Re-download from history | Same file bytes |
| EXP-10 | Special chars in narration `<& foo>` | Escaped properly |

---

## 12. Acceptance criteria

1. Tally XML conforms to Tally Prime import schema (verified by importing into a sandbox).
2. Excel workbook opens in Excel + LibreOffice + Google Sheets without errors.
3. JSON dump round-trips via `importJsonDump` into a fresh tenant.
4. Export history table is append-only.
5. Files older than 90 days are vacuumed (cron).
6. Tally Connector is behind a settings toggle (default off).
7. Branch and period filters honoured.
8. Audit log captures every export run.
