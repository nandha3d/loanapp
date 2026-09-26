# ZoloFund Micro Lending — Complete Web ↔ Mobile Feature & Data Parity Implementation Plan

**Repository:** `vigneshsinna/loanapp`  
**Branch:** `merged-all-branches`  
**Audit baseline commit:** `180dd9b2a6093eb3f09aa4bdf47d70092fc6f034`  
**Scope:** Micro Lending staff/admin mobile application parity with the current web application  
**Goal:** Every appropriate user-facing Micro Lending feature available on web must also be available on Flutter mobile, and the same tenant/module/branch/role/filter must produce the same business data and money values on both surfaces.

> **Important:** Re-run the audit against the latest `merged-all-branches` HEAD before starting implementation if the branch has moved beyond the commit above. Do not use older parity documents as implementation truth when they conflict with current code.

---

## 1. Target End State

After this implementation:

1. Web and mobile expose the same **business capabilities** for Micro Lending users, subject to the same RBAC.
2. Web and mobile use the same **server-side business logic** for calculations and mutations.
3. Flutter must not independently calculate financial results that are already calculated on the server.
4. Tenant, module, branch and role scoping must be identical across web and mobile.
5. The same customer, loan, collection, penalty, approval, wallet, report, KYC, accounting and settings data must be returned for the same scope.
6. Mobile-only field capabilities such as offline collection, QR scan, voice input, GPS and biometric lock may remain richer than web.
7. Infrastructure-only features such as cron jobs, inbound webhooks, health/debug endpoints and server backup internals remain system-only and do not require a mobile UI.
8. CI must be completely green, including `flutter analyze` and `flutter test`.

---

# 2. Architecture Rules — Mandatory

The implementation must follow `ENGINEERING_REFERENCE.md`.

## 2.1 Single source of business logic

Do **not** duplicate a web business operation inside a mobile API route.

Correct:

```text
Web action ───────┐
                  ├── Shared lib/domain service ── Prisma/DB
/api/v1 mobile ──┘
```

Incorrect:

```text
Web action ── Business Logic A ── DB
Mobile API ── Business Logic B ── DB
```

For every operation performed by both web and mobile, the actual operation must live in `lib/**`.

Relevant rules:

- `STRUCT-2` — shared `lib/**` must work for web and mobile.
- `STRUCT-3` — the same operation must use one shared business function.
- `SCOPE-1` — tenant scope required.
- `SCOPE-2` — module/appType scope required.
- `SCOPE-3` — branch scope must use the active branch.
- `SCOPE-5` — agents scope by customer/route linkage.
- `SCOPE-15` — superadmin/developer do not bypass branch filtering.
- `SCOPE-17` — strict module isolation.
- `API-2` — v1 responses use `ok()` / `fail()`.
- `API-4` — correct HTTP status codes.
- `ROLE-7` — agents cannot directly correct existing collection payments.

## 2.2 Financial calculations

The Flutter application must only **render** calculated values.

Do not calculate any of the following independently in Dart:

- loan repayment schedule
- interest
- disbursed amount
- total payable
- outstanding
- overdue
- collection allocation
- penalties
- penalty waiver/settlement totals
- NPA classification
- provisioning
- wallet balance
- branch cash
- P&L
- balance sheet
- trial balance
- cash flow
- budget variance
- report totals
- dashboard financial KPIs

The server/shared library is authoritative.

## 2.3 Scope contract

Every parity test must explicitly cover:

```text
Tenant
  ↓
Module / appType
  ↓
Active Branch
  ↓
Role / Access
```

For the same four-scope context, web and mobile must show the same records.

---

# 3. Current Parity Status

## 3.1 Already strong / should not be rebuilt

These areas already have strong parity and should only receive regression tests:

- Dashboard — broad operational parity
- Customers — list/new/detail/edit
- Customer credit score
- Customer KYC documents
- Loans — list/new/detail/edit
- Loan schedules
- Loan close/pre-close/restructure/renew flows already exposed where permitted
- Collection
- Collection runs
- Self-pay verification queue
- Offline collection
- Receipt generation
- QR collection
- Voice amount entry
- GPS collection/tracking
- Penalty settle
- Penalty waive
- General approvals
- Wallet / Agent Float
- Cash handover
- NPA
- Analytics
- Main report viewing
- Notifications centre
- Payment/integration settings
- Bureau configuration
- NPA settings
- Branding/settings basics
- Admin portal/team/branch/billing screens broadly present
- Android APK build

## 3.2 Remaining parity work

The remaining work is concentrated in:

1. Shared-data parity hardening
2. Aadhaar OTP eKYC on mobile
3. Video KYC initiation on mobile
4. Full route management from mobile
5. Loan package management from mobile
6. Notification template administration on mobile
7. 2FA enrol/disable settings parity
8. Optional strict parity for bulk customer/collection import
9. Report CSV/XLSX/PDF export/download/share from mobile
10. Notification delivery log on mobile
11. Premium Accounting write/action parity
12. Minor filter/search parity
13. Flutter analyzer/test CI cleanup
14. Automated web/mobile equivalence tests

---

# 4. Phase 0 — Create a Current Parity Contract

Before adding features, create one machine-readable parity source of truth.

## Files

Update:

```text
docs/mobile-parity/role-ui-map.json
docs/mobile-parity/ROLE-UI-MAPPING.md
docs/parity/mobile-vs-desktop.md
```

Add:

```text
docs/parity/microlending-feature-parity.json
```

Suggested structure:

```json
{
  "feature": "kyc.aadhaarOtp",
  "web": true,
  "mobile": true,
  "webSource": "app/(dashboard)/[module]/customers/[id]/CustomerProfileClient.tsx",
  "mobileSource": "mobile/lib/features/customers/customer_detail_screen.dart",
  "api": "/api/v1/kyc/aadhaar-otp",
  "sharedService": "lib/kyc/index.ts",
  "status": "full"
}
```

Allowed status:

```text
full
partial
mobile-only
system-only
web-only-by-design
```

Do not allow an undocumented `missing` feature at release time.

---

# 5. Phase 1 — Data Parity Hardening

This is required even when both UIs already contain the same-looking widgets.

## 5.1 Dashboard

Current risk:

- Web dashboard has substantial server-side query/calculation logic in:
  - `app/(dashboard)/[module]/dashboard/page.tsx`
- Mobile dashboard has substantial API query/calculation logic in:
  - `app/api/v1/dashboard/route.ts`

Even when values currently match, two large implementations can drift later.

## Required change

Extract the shared dashboard computation into:

```text
lib/dashboard/service.ts
```

Suggested functions:

```ts
getAdminDashboardData(context)
getAgentDashboardData(context)
getDashboardActivity(context, filters)
```

Context should contain only the resolved actor scope:

```ts
type DashboardContext = {
  tenantId: string;
  appType: string;
  branchId: string | null;
  userId: string;
  role: string;
};
```

Then:

```text
Web dashboard page -> shared service
/api/v1/dashboard -> shared service
```

Do not make the web page call Flutter-specific code and do not make the Flutter app reproduce the math.

### Must remain equal

- active loans
- overdue loans
- active customers
- today's expected
- today's collected
- today's remaining/gap
- overdue outstanding
- overdue collected today
- overdue total till today
- collection by mode
- current capital
- total disbursed
- total collected
- pending UPI
- route performance
- best payer
- highest borrower
- activity feed
- collection trend
- frequency/status breakdowns

## 5.2 Business date

Do not maintain separate IST calculations in multiple endpoints.

Use the shared business-time helper everywhere.

Relevant file:

```text
lib/businessTime.ts
```

Replace inline date-boundary code where possible with the shared helper.

Web and mobile must use the same:

```text
business date
start of day
end of day
timezone
```

## 5.3 Other parity-sensitive domains

Where web and v1 still repeat substantial logic, progressively extract to shared services:

```text
lib/customers/*
lib/loans/*
lib/collectionWrite.ts
lib/repayments.ts
lib/penalties.ts
lib/wallet.ts
lib/npa/*
lib/reports/*
lib/accounting/*
lib/kyc/*
```

Do not refactor stable code purely for aesthetics. Refactor where duplicate business rules can produce different data.

---

# 6. Phase 2 — Aadhaar OTP eKYC Mobile Parity

## Existing web implementation

Current shared/web files:

```text
lib/kyc/digio.ts
lib/kyc/index.ts
app/api/kyc/aadhaar-otp/route.ts
app/(dashboard)/[module]/customers/[id]/CustomerProfileClient.tsx
```

Existing shared operations include:

```text
startAadhaarOtpKyc
confirmAadhaarOtp
```

## Required mobile API

Add:

```text
app/api/v1/kyc/aadhaar-otp/route.ts
```

Supported actions:

### Initiate

```http
POST /api/v1/kyc/aadhaar-otp
Authorization: Bearer <token>

{
  "action": "initiate",
  "customerId": "...",
  "aadhaarNumber": "123412341234"
}
```

### Verify

```http
POST /api/v1/kyc/aadhaar-otp
Authorization: Bearer <token>

{
  "action": "verify",
  "sessionId": "...",
  "otp": "123456"
}
```

## Mandatory scope validation

Before calling the shared KYC operation, verify the customer belongs to:

```text
ctx.tenantId
ctx.appType
active branch / agent scope
```

Do **not** call `startAadhaarOtpKyc()` only because the customer ID exists in the tenant.

The current shared KYC functions primarily validate tenant ownership. The v1 adapter must not allow cross-module or cross-branch KYC access.

Preferred long-term improvement:

```text
refactor lib/kyc/index.ts to accept an actor scope object
```

so both web and mobile use identical scope validation.

## Flutter service

Update/create:

```text
mobile/lib/data/services/kyc_service.dart
```

Add:

```dart
Future<AadhaarOtpSession> startAadhaarOtp(...)
Future<AadhaarVerificationResult> verifyAadhaarOtp(...)
```

## Flutter UI

Update:

```text
mobile/lib/features/customers/customer_detail_screen.dart
mobile/lib/features/kyc/kyc_review_screen.dart
```

Add a KYC section equivalent to web:

```text
KYC Method
Aadhaar OTP
Aadhaar Number
Send OTP
OTP Input
Verify OTP
Verification status
Verified name
Verified DOB
Verified address
Verified photo when available
```

## Subscription gate

Use the same `kycEnabled` entitlement as web.

Do not show a functional action to an unsubscribed user.

## Security

- Aadhaar number must not be stored in plain text.
- Do not print Aadhaar/OTP to debug logs.
- Display masked Aadhaar.
- Never store the OTP.
- Expired OTP returns a clear error.
- Reused session must be rejected.

## Acceptance criteria

### Scenario: initiate Aadhaar OTP

Given an admin is inside an in-scope Micro Lending customer  
When the admin enters a valid Aadhaar number and taps **Send OTP**  
Then the same Digio-backed flow used by web is called  
And the customer KYC status becomes `otp_initiated`.

### Scenario: verify Aadhaar OTP

Given a valid OTP session exists  
When the user enters the correct OTP  
Then mobile displays the same verified Aadhaar information as web  
And the database contains the same KYC status/session result.

### Scenario: scope protection

Given a customer belongs to another branch/module/tenant  
When the mobile user attempts Aadhaar OTP KYC  
Then the API returns `403` or `404`  
And no KYC session is created.

---

# 7. Phase 3 — Video KYC Mobile Parity

## Existing shared/web operations

```text
startVideoKyc
reviewVideoKyc
```

Existing web route:

```text
app/api/kyc/video/route.ts
```

## Add v1 route

```text
app/api/v1/kyc/video/route.ts
```

### Start

```json
{
  "action": "start",
  "customerId": "..."
}
```

Response:

```json
{
  "sessionId": "...",
  "sessionUrl": "..."
}
```

### Review

Review already exists through the mobile KYC review route. Where necessary, use the same shared `reviewVideoKyc()` operation rather than having two review implementations.

## Flutter

Use:

```text
url_launcher
```

already present in `mobile/pubspec.yaml`.

Add:

```text
Initiate Video KYC
Open Verification Link
Refresh Status
Review Status
Approve/Reject where role permits
```

Do not add a second video-verification implementation inside Flutter. Digio remains the verification provider.

## Acceptance

- Same customer produces the same KYC session/status on web and mobile.
- Mobile opens the returned provider URL.
- Web-created KYC sessions appear on mobile.
- Mobile-created KYC sessions appear on web.
- Review results are visible on both platforms after refresh.

---

# 8. Phase 4 — Full Route Management Parity

## Current state

Mobile can currently read/create routes, but web supports more actions:

```text
createRoute
deleteRoute
assignAgentToRoute
setPrimaryAgent
removeAgentFromRoute
```

Current mobile v1 route:

```text
app/api/v1/routes/route.ts
```

currently supports:

```text
GET
POST
```

## Required architecture change

Do not copy the logic from `settings/actions.ts` into new v1 handlers.

Create a shared service:

```text
lib/routes/service.ts
```

Suggested operations:

```ts
listRoutes(ctx)
createRoute(ctx, input)
updateRoute(ctx, routeId, input)
deleteRoute(ctx, routeId)
assignAgentToRoute(ctx, routeId, agentId)
removeAgentFromRoute(ctx, routeId, agentId)
setPrimaryAgent(ctx, routeId, agentId | null)
```

Refactor:

```text
app/(dashboard)/[module]/settings/actions.ts
```

to delegate to the same service.

## API routes

Add:

```text
app/api/v1/routes/[id]/route.ts
```

Methods:

```text
PATCH
DELETE
```

Add:

```text
app/api/v1/routes/[id]/agents/route.ts
```

Methods:

```text
POST    -> assign shared agent
DELETE  -> remove shared agent
```

Add:

```text
app/api/v1/routes/[id]/primary-agent/route.ts
```

Method:

```text
PATCH
```

Payload:

```json
{
  "agentId": "..."
}
```

`null` clears primary agent.

## Validation

Every mutation must verify:

- tenant
- `appType`
- active branch
- route ownership
- agent exists
- agent role is `agent`
- agent is in the correct module
- agent is allowed for the route branch
- caller is admin/superadmin/developer
- agents cannot manage routes

## Mobile service

Extend:

```text
mobile/lib/data/services/settings_service.dart
```

Add:

```dart
updateRoute(...)
deleteRoute(...)
assignAgentToRoute(...)
removeAgentFromRoute(...)
setPrimaryAgent(...)
```

## Mobile UI

Update:

```text
mobile/lib/features/settings/settings_screen.dart
```

Each route row should provide:

```text
Route name
Primary agent
Shared agents
Customer count
Edit
Assign agent
Remove shared agent
Change primary agent
Delete
```

Use bottom sheets/dialogs, not dense desktop-style tables.

## Acceptance

A route edited on mobile appears identically on web after refresh.

A shared-agent assignment made on web appears on mobile.

A primary-agent change made on mobile updates customer collection ownership consistently.

---

# 9. Phase 5 — Loan Package Management Parity

## Current API

```text
app/api/v1/packages/route.ts
```

currently exposes `GET`.

## Existing web actions

```text
createLoanPackage
deleteLoanPackage
```

## Required

Extract package management to:

```text
lib/packages/service.ts
```

Then use it from:

```text
web settings actions
/api/v1/packages
```

Extend:

```text
POST /api/v1/packages
```

Add:

```text
DELETE /api/v1/packages/[id]
PATCH  /api/v1/packages/[id]   # if web supports package editing now or later
```

## Scope

Packages use master-data branch rules:

```text
branchOrSharedWhere(branchId)
```

Do not apply operational-row scoping rules blindly.

## Mobile UI

Update:

```text
mobile/lib/features/settings/settings_detail_screen.dart
```

Packages section:

```text
View package
Create package
Deactivate/delete package
Edit when supported by web
```

Use the same:

- frequency
- interest model
- tenure
- rate
- penalty defaults
- module
- branch/shared visibility
- status

## Acceptance

Creating/deleting a package from mobile changes the same rows consumed by the web loan creation screen.

---

# 10. Phase 6 — Notification Template Settings Parity

Web settings currently contain:

```text
saveNotificationTemplate
```

Mobile currently configures channels/settings but does not expose the complete template administration workflow.

## Add v1 API

Suggested:

```text
GET   /api/v1/settings/notification-templates
POST  /api/v1/settings/notification-templates
PATCH /api/v1/settings/notification-templates/[id]
```

Prefer shared service:

```text
lib/notify/templates.ts
```

Both web and v1 should delegate to it.

## Mobile

Update:

```text
mobile/lib/features/settings/notification_settings_screen.dart
```

Add template management for the same events/channels supported by web.

Do not allow unsupported placeholders.

Validate templates server-side.

---

# 11. Phase 7 — 2FA Settings Parity

Mobile already supports the login TOTP challenge, but web settings also expose enrol/disable actions:

```text
generate2faSecret
verifyAndEnable2fa
disable2fa
```

## Add secure v1 settings endpoints

Suggested:

```text
POST   /api/v1/settings/2fa/setup
POST   /api/v1/settings/2fa/verify
DELETE /api/v1/settings/2fa
```

Rules:

- admin/superadmin/developer according to current policy
- never return an existing stored secret after enrolment
- setup secret is temporary until verification
- apply rate limiting to verification
- do not log TOTP values

## Mobile UI

Add under Security:

```text
Enable 2FA
Display QR / manual secret during setup only
Enter verification code
Disable 2FA
```

Biometric lock remains a mobile-only feature.

---

# 12. Phase 8 — Bulk Customer / Collection Import

This is required only if the target is **strict user-feature parity** with the web Settings page.

Web actions already include:

```text
importCustomers
importCollections
```

## Preferred implementation

Do not submit unbounded CSV rows one-by-one from Flutter.

Add shared parsers/import functions under:

```text
lib/imports/customers.ts
lib/imports/collections.ts
```

Both web and mobile adapters call the same functions.

## API

Suggested:

```text
POST /api/v1/import/customers
POST /api/v1/import/collections
```

Use multipart upload or file upload + import token.

Return:

```json
{
  "total": 100,
  "success": 94,
  "failed": 6,
  "errors": [
    {
      "row": 12,
      "field": "phone",
      "message": "Duplicate customer"
    }
  ]
}
```

## Flutter dependency

A generic document picker is currently not present.

If implementing CSV upload from mobile, add a single well-maintained dependency such as:

```text
file_picker
```

This is an acceptable `DEP-1` addition because Flutter currently has image/media pickers but no generic CSV/XLSX document picker.

Document the dependency reason in the PR.

## Mobile UI

Add under Bulk Data:

```text
Import Customers
Import Collections
Download/Display template instructions
Select file
Validation preview
Import
Result summary
Failed row list
```

## Important

Do not implement destructive `wipeDatabaseRecords` on mobile as part of normal Micro Lending parity.

Treat database wipe as a developer/system administration capability unless the product explicitly decides otherwise.

---

# 13. Phase 9 — Report Export Parity

## Good news

The backend already supports mobile-compatible dual authentication:

```text
app/api/v1/reports/[slug]/export/route.ts
```

It already supports:

```text
?format=csv
?format=excel
?format=pdf
```

and uses the same report builder as the data view.

Therefore:

> **Do not create another report-export backend route.**

## Flutter implementation

Update:

```text
mobile/lib/data/services/reports_service.dart
mobile/lib/features/reports/reports_screen.dart
```

Add service method:

```dart
Future<ReportDownload> exportReport({
  required String slug,
  required String format,
  required Map<String, dynamic> filters,
})
```

Use Dio:

```text
ResponseType.bytes
```

Use the same current report filters:

- from
- to
- branch
- agent
- route
- customer
- loan type
- status
- frequency
- amount range
- payment mode
- payment status
- loan/group where relevant

## PDF

The project already includes:

```text
printing
```

Use `Printing.sharePdf()` where appropriate.

## CSV/XLSX

Flutter currently has no generic file-share dependency.

Add:

```text
share_plus
```

only if needed for CSV/XLSX share/open.

Reason:

> Web supports CSV/XLSX/PDF report downloads; `printing` only covers PDF sharing. A generic native file share capability is required for strict report-export parity.

Use `path_provider` for a temporary file.

## UX

Each report should expose:

```text
Export
  PDF
  Excel
  CSV
```

Show:

```text
Preparing...
Downloaded/Ready
Share/Open
Error
```

## Acceptance

For identical filters:

```text
Mobile on-screen report total
Web on-screen report total
CSV total
Excel total
PDF total
```

must all match.

---

# 14. Phase 10 — Notification Delivery Log

Web has:

```text
app/(dashboard)/[module]/notifications/log/page.tsx
```

backed by:

```text
NotificationLog
```

Mobile only exposes the normal in-app notification centre.

## Add API

```text
app/api/v1/notifications/log/route.ts
```

Minimum GET query parameters:

```text
channel
status
from
to
search
cursor
limit
```

Response fields:

```text
id
channel
recipient
status
errorMessage
entityType
entityId
event
messageBody
provider
providerMsgId
createdAt
```

## Important schema note

`NotificationLog` currently stores `tenantId` but does **not** store `appType` or `branchId`.

Do not invent an `appType` filter in the API unless the schema/writers are migrated first.

Two valid approaches:

### Option A — Exact current web parity

Return the same tenant-wide outbound log that the web page currently displays.

### Option B — Stronger module isolation

If product requirement is that each module only sees its own delivery logs:

1. Add `appType` and optionally `branchId` to `NotificationLog`.
2. Create a Prisma migration.
3. Update **all** notification writers.
4. Backfill existing rows where deterministically possible.
5. Update the web log page and mobile API together.
6. Add module/branch indexes.
7. Only then filter the API.

Do not filter a column that existing rows/writers do not populate.

## Flutter UI

Add either:

```text
/notifications/log
```

or a **Delivery Log** tab in the existing notifications screen.

Recommended fields:

```text
Channel
Recipient
Event
Status
Provider
Timestamp
Error reason when failed
```

Filters:

```text
All / Sent / Delivered / Failed / Pending
SMS / WhatsApp / Email / In-app
Date range
Search
```

---

# 15. Phase 11 — Premium Accounting Full Action Parity

This is the largest remaining area.

## 15.1 Current mobile state

The mobile accounting screen already exposes broad read/view coverage:

- dashboard
- chart of accounts
- journal list/details
- periods
- P&L
- balance sheet
- trial balance
- cashflow
- approvals
- budgets
- tax
- vendors
- export runs
- premium settings
- bank reconciliation

Some write actions are already present:

- CoA toggle/reseed
- journal approve/reject/reverse
- period locks
- bank reconciliation actions

Do not rebuild these.

## 15.2 Current service support already present

`mobile/lib/data/services/accounting_service.dart` already contains methods such as:

```text
createCoAAccount
updateCoAAccount
postJournal
draftJournal
approveJournal
rejectJournal
reverseJournal
postDraftJournal
deleteDraftJournal
reviewAccountingApproval
```

Several methods simply do not have a complete mobile UI yet.

Start by wiring existing service capabilities before adding new APIs.

---

## 15.3 Chart of Accounts

### Mobile missing UI

Add:

```text
Create account
Edit account
```

Use the already-present service methods.

Validation must remain server-side.

---

## 15.4 Journal Entry

Web supports:

```text
listJournalEntries
getJournalEntry
postEntry
saveDraftEntry
postDraftEntry
deleteDraftEntry
reverseEntry
listActiveAccounts
approveEntry
rejectEntry
```

Mobile service already has most corresponding methods.

### Add mobile UI

Create:

```text
mobile/lib/features/accounting/journal_entry_form.dart
```

Capabilities:

```text
New journal
Entry date
Narration
Branch where permitted
Multiple debit/credit lines
Account selector
Debit
Credit
Save Draft
Post
```

Validation:

```text
Total debit == Total credit
No negative lines
At least two meaningful lines
Period not locked
Role limits
Approval thresholds
```

These validations must be performed by the shared server logic.

---

## 15.5 Accounting Approvals

Backend already supports:

```text
GET  /api/v1/accounting/approvals
POST /api/v1/accounting/approvals
```

Mobile service already has:

```text
reviewAccountingApproval()
```

Therefore this is mainly a UI task.

Add:

```text
Approve
Reject
Review note
L1/L2 indicator
Entity type
Amount
Requester
Status
```

Role behavior must match web:

- admin: own/request scope according to accounting policy
- superadmin/developer: reviewer capabilities
- developer L2 where applicable

---

# 16. Budgets

Current v1 budget route is read-only.

Web supports:

```text
listBudgets
createBudget
getBudgetWithLines
updateBudgetLine
addBudgetLine
approveBudget
archiveBudget
getVarianceForPeriod
getActiveAccounts
```

## First refactor

Do not copy those server actions into the API.

Extract the business operations into:

```text
lib/accounting/budgets.ts
```

or extend the existing premium shared service.

Both:

```text
web budget actions
v1 budget routes
```

must call the shared service.

## API

Suggested:

```text
GET  /api/v1/accounting/budget
POST /api/v1/accounting/budget
GET  /api/v1/accounting/budget/[id]
PATCH /api/v1/accounting/budget/[id]/lines/[lineId]
POST /api/v1/accounting/budget/[id]/lines
POST /api/v1/accounting/budget/[id]/approve
POST /api/v1/accounting/budget/[id]/archive
GET  /api/v1/accounting/budget/[id]/variance
```

## Mobile

Add:

```text
Create budget
Budget detail
Add account
Monthly amount edit
Annual total
Variance
Approve
Archive
```

---

# 17. Vendors / Accounts Payable

Web operations:

```text
listVendors
createVendor
updateVendor
deactivateVendor
listBills
getBill
createBill
postBill
payBill
cancelBill
getAgeingReport
getExpenseAccounts
getBankAccounts
```

Current v1 vendor route is mainly read-only.

## Required refactor

Extract to:

```text
lib/accounting/vendors.ts
```

or a shared premium accounting operations module.

All money movement must stay transactional.

## API

Suggested:

```text
GET    /api/v1/accounting/vendors
POST   /api/v1/accounting/vendors
PATCH  /api/v1/accounting/vendors/[id]
DELETE /api/v1/accounting/vendors/[id]

GET    /api/v1/accounting/vendors/[id]/bills
POST   /api/v1/accounting/vendors/[id]/bills
GET    /api/v1/accounting/bills/[id]
POST   /api/v1/accounting/bills/[id]/post
POST   /api/v1/accounting/bills/[id]/pay
POST   /api/v1/accounting/bills/[id]/cancel
GET    /api/v1/accounting/vendors/ageing
```

## Mobile UI

Vendor:

```text
Create
Edit
Deactivate
GSTIN
PAN
Phone/email
TDS configuration
Bank details
Outstanding AP
Bill count
```

Bill:

```text
Create bill
Expense account
Tax/GST
TDS
Amount
Due date
Draft
Post
Pay
Cancel
Payment account
```

All journal postings must come from the existing accounting business layer.

---

# 18. Tax & GST Action Parity

Web operations:

```text
recomputeGstSummary
markGstFiled
getGstSummary
getTdsRegister
recordChallan
```

Current mobile mainly reads the summary.

## Shared service

Extract/reuse:

```text
lib/accounting/tax.ts
```

## v1 API

Extend the tax route with explicit actions:

```json
{ "action": "recompute", "periodKey": "2026-09" }
{ "action": "mark_filed", "periodKey": "2026-09" }
{ "action": "record_challan" }
```

or use separate REST endpoints.

## Mobile UI

Add:

```text
Recompute GST
Mark Filed
TDS Register
Record Challan
Filing metadata
```

Respect existing role restrictions.

---

# 19. Accounting Export / Tally Parity

Web operations:

```text
exportTallyXml
exportJsonDump
exportExcelWorkbook
listExportRuns
testTallyConnector
pushToTally
```

Current mobile only lists export runs.

## Required

Refactor reusable export generation into shared `lib/accounting/export/**`.

Extend v1 export API to support:

```text
Generate Tally XML
Generate JSON dump
Generate Excel workbook
Test Tally connector
Push to Tally
List previous export runs
Download generated export
```

## Security

Tally connector configuration and push should remain superadmin/developer only if that is the existing web rule.

Do not expose connector credentials to mobile.

---

# 20. Premium Accounting Settings

Current v1 accounting settings route is read-only.

Web supports:

```text
getSettings
updateSettings
migrateBasicAccountingData
getMigrationStats
getBankAndCashAccounts
```

## API

Extend:

```text
PATCH /api/v1/accounting/settings
```

For normal settings update.

Migration should be exposed separately and only if strict parity is required:

```text
POST /api/v1/accounting/settings/migrate-basic
GET  /api/v1/accounting/settings/migration-status
```

Role protect aggressively.

## Mobile UI

Edit the same supported settings:

- fiscal year start
- GSTIN
- state
- GST scheme
- base currency
- posting overrides
- cost centres
- accounting mode
- admin JE cap
- admin bill cap
- two-level approval threshold
- CoA edit permission
- period-lock permission
- variance alert
- AP overdue alert
- allow future dated
- default bank account
- default cash account
- Tally connector configuration where role permits

---

# 21. Phase 12 — Penalty Filter/Search Parity

Mobile now supports:

```text
status
route
settle
waive
```

Web also supports text search.

## Extend v1 penalties GET

Support:

```text
?q=
&status=
&routeId=
```

The server should filter by:

```text
customer name
customer code
loan code where web supports it
```

Update mobile to use server filters rather than loading the full data set and filtering everything locally.

This also improves scalability.

---

# 22. Phase 13 — Notification and Report Pagination

Any large list that can grow indefinitely must use pagination/cursor loading.

Ensure:

- notifications
- notification delivery log
- customers
- approvals
- penalties where needed
- reports where data size is large
- accounting journals
- vendors/bills
- export runs

Use consistent mobile page sizes.

Do not make mobile download the entire tenant dataset merely to apply a UI filter.

---

# 23. Phase 14 — Web/Mobile Data Equivalence Test Suite

Add a dedicated automated suite.

Suggested file:

```text
tests/microlendingWebMobileParity.test.ts
```

and business integration suite:

```text
tests/e2e-business/microlendingWebMobileDataParity.test.ts
```

## Seed one deterministic scenario

Create:

```text
Tenant A
  Branch A1
  Branch A2

Admin
Superadmin
Agent A1
Agent A2

Customers
Loans
Instalments
Collections
Penalties
Approvals
Wallet/float
KYC sessions
Reports data
Accounting entries
Notifications
```

## Required comparisons

### Dashboard

For the same branch/role compare:

```text
web shared dashboard service
mobile dashboard shared service/API
```

Values:

```text
todayExpected
todayCollected
todayGap
overdueOutstanding
overdueCollectedToday
currentCapital
totalDisbursed
totalCollectedAllTime
todayByMode
routePerformance
```

### Customer

Compare:

```text
identity/profile fields
route
agent
KYC status
credit score
loan counts
documents
guarantors
security cheques
```

### Loan

Compare:

```text
principal
interest type/rate
disbursed
total payable
collected
outstanding
schedule
penalty summary
status
```

### Collection

Submit a payment through mobile API and verify web reads:

```text
same CollectionEntry
same Payment
same PaymentAllocation
same Instalment.receivedAmount
same Loan.totalCollected
same outstanding
same agent wallet effect
```

Submit equivalent web operation and verify mobile reads the same data.

### Penalty

Compare:

```text
gross
settled
waived
net
status
```

### Wallet

Compare:

```text
agent balance
branch cash
transaction history
handover
```

### Reports

For the same filters compare the report builder payload before serialization.

Then verify:

```text
screen payload == CSV source payload == Excel source payload == PDF source payload
```

### KYC

Create from mobile, read on web.

Create/review on web, read on mobile.

### Accounting

Post a journal on one surface and confirm:

```text
journal
journal lines
account balances
P&L
balance sheet
trial balance
cash flow
```

all update identically for the other surface.

---

# 24. Negative Scope Tests — Mandatory

For every major API, add tests proving that IDs cannot bypass scope.

## Cross-tenant

Tenant A token must not read or mutate Tenant B data.

Expected:

```text
403 or 404
```

## Cross-module

Micro Lending token must not read Auto Finance operational data.

## Cross-branch

When Branch A1 is active, an A1 admin must not read or mutate A2 operational rows.

## Agent

Agent A1 can only see customers/loans linked through permitted routes/customer access.

Agent must not reach:

```text
settings
reports
analytics
accounting
penalties
admin route management
```

unless product rules explicitly permit a specific operation.

---

# 25. Flutter Quality Gate — Must Be Fixed

Current GitHub state on the audited commit:

```text
Backend quality job      PASS
Secret scan              PASS
Android APK build        PASS
Flutter analyze          FAIL
Flutter test             SKIPPED
```

The analyzer is currently failing mainly on lint/info items such as:

```text
require_trailing_commas
prefer_const_constructors
deprecated_member_use
curly_braces_in_flow_control_structures
```

## Required cleanup

Run:

```bash
cd mobile

dart format lib test
flutter analyze
flutter test
```

Fix every issue that causes non-zero analyze status.

Do not disable analyzer rules merely to make CI green unless there is a documented technical reason.

Particularly:

- replace deprecated form-field `value` usage with `initialValue` where required
- add required braces
- apply formatter/trailing commas
- apply `const` where safe
- remove dead imports
- fix any actual analyzer error before lint cleanup

`flutter test` must no longer be skipped because of the previous analyzer step.

---

# 26. CI / Verification Commands

## Backend

Run from repository root:

```bash
npm ci
npm run db:generate
npm run typecheck
npm run test:ci
npm run test:mobile-parity-api
npm run test:coverage
npm run i18n:check
npm run ui-map:roles
```

Run relevant Micro Lending Playwright/E2E suites.

## Flutter

```bash
cd mobile
flutter pub get
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build apk --release
```

Also validate iOS in the configured iOS workflow.

---

# 27. Required New/Updated Tests

At minimum add or extend:

```text
tests/mobileParityRoutes.test.ts
tests/mobileParityAuditValidation.test.ts
tests/desktopMobileParity.test.ts
tests/microlendingWebMobileParity.test.ts
tests/e2e-business/mobileAdminApiParity.test.ts
tests/e2e-business/microlendingWebMobileDataParity.test.ts
```

Flutter:

```text
mobile/test/kyc_parity_test.dart
mobile/test/route_management_test.dart
mobile/test/report_export_test.dart
mobile/test/notification_log_test.dart
mobile/test/accounting_write_parity_test.dart
mobile/test/settings_parity_test.dart
```

Do not make tests source-code-regex-only where a real behavior test is possible.

Use source-contract tests only for architectural invariants.

---

# 28. UI Acceptance Checklist

## Customer / KYC

- [ ] Aadhaar OTP can be initiated on mobile.
- [ ] OTP can be verified.
- [ ] Verified Aadhaar details appear.
- [ ] Video KYC can be initiated.
- [ ] Video provider link opens.
- [ ] Review status syncs web ↔ mobile.
- [ ] Subscription gate matches web.
- [ ] No raw Aadhaar exposed.

## Routes

- [ ] Create route.
- [ ] Edit route.
- [ ] Delete route.
- [ ] Assign shared agent.
- [ ] Remove shared agent.
- [ ] Set/change/clear primary agent.
- [ ] Branch scope identical to web.

## Loan packages

- [ ] List.
- [ ] Create.
- [ ] Delete/deactivate.
- [ ] Edit if web supports edit.
- [ ] Package immediately available in loan creation.

## Notifications

- [ ] Notification settings match.
- [ ] Templates can be administered.
- [ ] Delivery log exists.
- [ ] Sent/delivered/failed/pending states render.
- [ ] Provider error visible to authorized admin.

## Reports

- [ ] Same report catalog as web for Micro Lending.
- [ ] Same filters.
- [ ] Same totals.
- [ ] CSV export.
- [ ] XLSX export.
- [ ] PDF export.
- [ ] File can be opened/shared.

## Accounting

- [ ] Create/edit CoA account.
- [ ] Create journal.
- [ ] Save journal draft.
- [ ] Post draft.
- [ ] Delete draft.
- [ ] Approve/reject journal.
- [ ] Reverse journal.
- [ ] Review accounting approval.
- [ ] Create budget.
- [ ] Edit budget lines.
- [ ] Approve/archive budget.
- [ ] View variance.
- [ ] Create/edit/deactivate vendor.
- [ ] Create/post/pay/cancel bill.
- [ ] Vendor ageing.
- [ ] GST recompute.
- [ ] Mark GST filed.
- [ ] TDS register.
- [ ] Record challan.
- [ ] Generate accounting export.
- [ ] Download export.
- [ ] Tally connector test/push where permitted.
- [ ] Edit premium settings.

## Settings/Security

- [ ] 2FA setup.
- [ ] 2FA verification.
- [ ] 2FA disable.
- [ ] Existing biometric lock still works.
- [ ] Optional bulk imports if strict parity is required.

---

# 29. Data Acceptance Checklist

For the same user, module and active branch:

- [ ] Customer count matches.
- [ ] Loan count matches.
- [ ] Loan principal matches.
- [ ] Loan total payable matches.
- [ ] Outstanding matches.
- [ ] Today's expected collection matches.
- [ ] Today's collected matches.
- [ ] Overdue amount matches.
- [ ] Collection payment-mode totals match.
- [ ] Penalty gross/settled/waived/net match.
- [ ] Wallet/float balance matches.
- [ ] Cash handover state matches.
- [ ] Approval status matches.
- [ ] KYC status matches.
- [ ] NPA state matches.
- [ ] Report totals match.
- [ ] Accounting totals match.
- [ ] Notification state matches.
- [ ] Route/customer ownership matches.

Money comparisons must use canonical server/Decimal values and final currency rounding rules.

---

# 30. Definition of Done

Do **not** mark this parity work complete until every item below is true.

## Functional

- [ ] Every normal user-facing Micro Lending web capability has a mobile equivalent.
- [ ] Remaining intentional web-only/system-only features are explicitly documented.
- [ ] Mobile has no placeholder/no-op buttons for parity features.
- [ ] All actions work against real APIs.

## Architecture

- [ ] No duplicated financial business logic between web and v1.
- [ ] Shared operations are in `lib/**`.
- [ ] Every v1 route uses authenticated context.
- [ ] Tenant/module/branch/role checks are applied.
- [ ] No client-supplied scope value is trusted over authenticated context.

## Data

- [ ] Web/mobile equivalence tests pass.
- [ ] Cross-tenant tests pass.
- [ ] Cross-module tests pass.
- [ ] Cross-branch tests pass.
- [ ] Agent isolation tests pass.

## Quality

- [ ] TypeScript typecheck passes.
- [ ] Backend CI tests pass.
- [ ] Mobile parity API tests pass.
- [ ] Coverage gate passes.
- [ ] `flutter analyze` passes.
- [ ] `flutter test` passes.
- [ ] Android release build passes.
- [ ] iOS CI build passes.
- [ ] i18n checks pass.

## Documentation

- [ ] `ENGINEERING_REFERENCE.md` updated if any architecture rule changed.
- [ ] Role UI mapping updated.
- [ ] Mobile-vs-web parity matrix updated.
- [ ] API contract documented.
- [ ] New dependencies and reasons documented.
- [ ] Final parity status contains no unexplained `partial` or `missing` items.

---

# 31. Recommended Implementation Order

Implement in this order to reduce rework:

```text
1. Shared data-parity service extraction
2. Flutter analyzer cleanup
3. Aadhaar OTP KYC
4. Video KYC
5. Route management
6. Loan package management
7. Notification templates
8. 2FA settings
9. Report export
10. Notification delivery log
11. Accounting CoA/Journal action UI
12. Accounting approvals
13. Budgets
14. Vendors / Bills
15. Tax / GST / TDS actions
16. Accounting export/Tally
17. Premium accounting settings
18. Penalty/search/filter cleanup
19. Optional bulk imports
20. Full web/mobile equivalence E2E
21. Final Android/iOS release validation
```

---

# 32. Final Expected Parity Matrix

After completion:

| Area | Web | Mobile | Expected Status |
|---|---:|---:|---|
| Dashboard | ✅ | ✅ | Full |
| Agent Dashboard behavior | ✅ | ✅ | Full |
| Customers | ✅ | ✅ | Full |
| Customer Edit | ✅ | ✅ | Full |
| Customer KYC Documents | ✅ | ✅ | Full |
| Aadhaar OTP KYC | ✅ | ✅ | Full |
| Video KYC | ✅ | ✅ | Full |
| Loans | ✅ | ✅ | Full |
| Loan Edit | ✅ | ✅ | Full |
| Loan Servicing | ✅ | ✅ | Full |
| Collection | ✅ | ✅ | Full |
| Collection Runs | ✅ | ✅ | Full |
| Self-Pay | ✅ | ✅ | Full |
| Offline Collection | N/A | ✅ | Mobile-only |
| QR / Voice Collection | N/A/limited | ✅ | Mobile-only |
| Penalties | ✅ | ✅ | Full |
| Approvals | ✅ | ✅ | Full |
| Wallet / Float | ✅ | ✅ | Full |
| GPS / Route Tracking | ✅ | ✅ | Full |
| Analytics | ✅ | ✅ | Full |
| Reports | ✅ | ✅ | Full |
| Report Export | ✅ | ✅ | Full |
| NPA | ✅ | ✅ | Full |
| Notifications | ✅ | ✅ | Full |
| Notification Delivery Log | ✅ | ✅ | Full |
| Route Management | ✅ | ✅ | Full |
| Loan Packages | ✅ | ✅ | Full |
| Settings | ✅ | ✅ | Full |
| 2FA | ✅ | ✅ | Full |
| Premium Accounting Read | ✅ | ✅ | Full |
| Premium Accounting Write | ✅ | ✅ | Full |
| Bank Reconciliation | ✅ | ✅ | Full |
| Budget | ✅ | ✅ | Full |
| Vendors / AP | ✅ | ✅ | Full |
| Tax / GST / TDS | ✅ | ✅ | Full |
| Accounting Export / Tally | ✅ | ✅ | Full |
| Bulk Import | ✅ | ✅* | Full if strict parity enabled |
| Cron / Webhooks / Health | System | System | System-only |
| Biometric App Lock | — | ✅ | Mobile-only |

---

# 33. Release Gate

The release should be blocked if any of the following is true:

```text
flutter analyze != PASS
flutter test != PASS
backend parity tests != PASS
tenant isolation != PASS
module isolation != PASS
branch isolation != PASS
money parity != PASS
report total parity != PASS
accounting debit/credit parity != PASS
```

A successful APK build alone is **not** sufficient evidence of web/mobile parity.

The final proof must be:

> **Same business action + same scoped data + same shared server calculation = same business result on web and mobile.**
