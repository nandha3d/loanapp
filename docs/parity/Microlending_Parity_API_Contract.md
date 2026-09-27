# Micro Lending parity API additions

All v1 endpoints use bearer authentication, the active module and branch resolved from authenticated context, and the standard `ok()` / `fail()` envelope. No request body may set tenant, module, branch, or role scope.

## Customer JSON import

`POST /api/v1/import/customers` accepts `Content-Type: application/json` and an array of `{ "name": "...", "phone": "...", "customerCode"?: "...", "aadhaar"?: "12 digits", "pan"?: "..." }`. Admin, superadmin, and developer may import into an active branch; agents receive 403, and an All Branches selection receives 400. The web Settings action uses the same `lib/imports/customers.ts` operation.

The response data contains `total`, `success`, `failed`, and `errors: [{ row, message }]`. Rows are numbered from 1. Each successful customer and audit row commit together. Invalid or duplicate rows fail independently. Aadhaar is encrypted before storage and never returned in errors. `customer_import_max_rows` (default 1000) and `customer_import_max_bytes` (default 1048576) are tenant settings. The mobile app uses `file_picker` to select JSON because its existing media pickers cannot select documents.

The web collection import control remains disabled; its old action only counts rows. It is not a shipped collection capability and has no mobile import endpoint.

## Dashboard daily values

`GET /api/v1/dashboard` returns `todayExpected`, `todayCollected`, `todayGap`, and `cashCollectedToday`. The first three use today's scheduled instalments after shared repayment distribution. `todayCollected` is capped by each due amount. `cashCollectedToday` includes all payment modes received today, including payments against overdue or future instalments. Both web and v1 use `lib/dashboard/todayMetrics.ts` and `lib/businessTime.ts`.

For staff roles, `currentCapital`, `totalDisbursed`, and `totalCollectedAllTime` use `lib/dashboard/bookTotals.ts` on both surfaces. Capital and lifetime collections come from scoped cash-book entries; total disbursed is gross loan principal. Agent dashboard totals keep their agent-linked loan scope, and `currentCapital` is `null` for agents.

## Accounting export

`POST /api/v1/accounting/export` accepts `action: generate`, `test_tally`, or `push_tally`. `generate` takes `kind: tally_xml | json | excel` plus a valid period or date range and returns `filename`, `mimeType`, and base64 file bytes. Only superadmin/developer may generate or push. The mobile app shares generated files through the platform share sheet. Export responses do not include connector credentials. Invalid URLs return 400; exports exceeding `tally_export_max_vouchers` (default 50000) return 413 without a partial XML file.

## Release status

The code paths above have type, unit, analyzer, and Flutter test coverage. Live web/mobile data equivalence, Android release build, and iOS CI build remain release gates. See `microlending-feature-parity.json` for the current feature status.
