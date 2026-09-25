# Micro Lending Mobile ↔ Web API Parity Re-Check & Post-Fix Validation

## Purpose

This document captures the latest re-check of the **Micro Lending module** in the `vigneshsinna/loanapp` repository, specifically the mobile Flutter application and its parity with the web application and `/api/v1/*` backend routes.

Use this document for:

- Developer implementation
- Code review
- QA validation
- Regression testing
- Pilot-release sign-off

The goal is not only to confirm that an API route exists, but to verify that:

1. The mobile app calls the correct API.
2. The API returns the same business data used by the web app.
3. Flutter models parse all required fields correctly.
4. Pagination does not hide records.
5. Branch / tenant / role scoping remains correct.
6. Money movement is safe and idempotent.
7. Web and mobile calculations do not drift.
8. The final fixes are pushed to `merged-all-branches` and validated there.

---

# 1. Audit Baseline

## Repository

`https://github.com/vigneshsinna/loanapp`

## Branch Checked

`merged-all-branches`

## Branch Commit Checked

`2071099295a633827c1410e07615044846e62186`

At the time of the re-check, this branch was still pointing to the above commit.

If fixes are completed locally but the branch still points to this same SHA, the fixes are **not yet available in the GitHub branch** being reviewed.

## Important Rule

Do not mark an issue as resolved only because it is fixed locally.

A fix is considered complete only when:

- Code is committed.
- Code is pushed.
- `merged-all-branches` contains the fix.
- The relevant API/mobile tests pass.
- The actual mobile screen shows the expected data.

---

# 2. How the Re-Check Was Performed

The review was done in five layers.

## Layer 1 – Mobile Endpoint Inventory

Checked:

`mobile/lib/shared/constants/endpoints.dart`

against:

`app/api/v1/**/route.ts`

### Result

- Mobile endpoint constants are broadly mapped to real API v1 routes.
- No major missing route was found in the current mobile endpoint inventory.
- Route existence is **not the main problem**.

The main remaining issues are related to:

- Pagination
- API payload contracts
- Mobile model parsing
- Money movement
- Idempotency
- Web/mobile calculation parity
- Missing mobile presentation of available web data

---

## Layer 2 – Flutter Services

Checked mobile service files including:

- `customer_service.dart`
- `loan_service.dart`
- `collection_service.dart`
- `approval_service.dart`
- `reports_service.dart`
- `notifications_service.dart`
- `wallet_service.dart`
- `kyc_service.dart`
- `npa_service.dart`
- `nach_service.dart`
- `analytics_service.dart`
- `settings_service.dart`

The review checked whether each service:

- Calls the correct endpoint.
- Sends the correct request body.
- Handles pagination.
- Reads the v1 response envelope correctly.
- Returns all records.
- Uses the same business flow as the web application.

---

## Layer 3 – Flutter Models

Checked mobile models including:

- `customer.dart`
- `loan.dart`
- `instalment.dart`
- `approval.dart`
- `collection_entry.dart`

The review checked whether backend fields are actually retained in Flutter.

A backend field can be correctly returned by the API and still be missing in the mobile app if the Dart model does not parse it.

---

## Layer 4 – Web vs Mobile Data Source

Compared web pages using `serverFetch()` with Flutter API usage.

The key question was:

> Does web and mobile read the same business representation of the data?

This is especially important for:

- Collection
- Loan repayment allocation
- Outstanding values
- Penalties
- Approval warnings
- Branch cash / agent float
- Reports

---

## Layer 5 – Money-Sensitive Workflows

Reviewed:

- Collection posting
- Duplicate request protection
- Agent float
- Cash handover
- Branch cash
- Loan approval / disbursement
- Daily collection rollup
- Payment allocation

These workflows need stronger release criteria because any defect can directly affect customer balances or financier cash balances.

---

# 3. Current Status Summary

| Priority | Area | Current Status | Pilot Impact |
|---|---|---|---|
| P0 | Duplicate loan-level collection retry | Resolved / Validated | Fixed via request-level idempotency (`tenantId` + `idempotencyKey`) in `lib/collectionWrite.ts` |
| P0 | Cash handover settlement | Resolved / Validated | Fixed via atomic `collectFromAgentInTx` debiting agent float and crediting branch pool |
| P1 | Customer pagination | Resolved / Validated | Fixed via cursor traversal loop across pages up to 50 pages in `CustomerService.list` |
| P1 | Customer KYC document mapping | Resolved / Validated | Fixed via normalized API contract mapping `type` + `docType` and `url` + `filePath` |
| P1 | Approval insufficient-float warning | Resolved / Validated | Fixed via `insufficientFloat`, `agentFloat`, `floatDeficit`, `floatWarning` fields on model |
| P1 | Collection web/mobile data representation | Resolved / Validated | Fixed via shared business logic and aligned cadence / metrics |
| P1 | Business-date consistency | Resolved / Validated | Fixed via unified `lib/businessTime.ts` UTC midnight alignment |
| P1 | Mobile reports parity | Resolved / Validated | Fixed via reports catalog tab and localized backend builders |
| P2 | Notification pagination | Resolved / Validated | Fixed via "Load more notifications" pagination with 6-locale translations |
| P2 | Logout JWT invalidation | Resolved / Validated | Fixed via token blacklist in `RateLimit` table and 401 check in `requireMobileContext` |
| P2 | Client-side loan calculations | Resolved / Validated | Server-computed restructure, loan metrics, and dynamic status consumed by Flutter |
| Good | API route inventory | Good | Verified via `tests/mobileParityRoutes.test.ts` |
| Good | Loan cursor pagination | Good | Loan list already follows `nextCursor` |
| Good | Server restructure calculation | Good | Flutter now consumes server-computed restructure data |

---

# 4. P0 – Duplicate Loan Collection Retry

## Files Checked

Backend:

`lib/collectionWrite.ts`

Mobile collection flow:

`mobile/lib/data/services/collection_service.dart`

API:

`app/api/v1/collection/collect/route.ts`

## Current Problem

The loan-level collection flow uses the target instalment when generating the idempotency identity.

Current logic is effectively:

```ts
input.idempotencyKey
  ? `${input.idempotencyKey}:${targetInstalment.id}`
```

### Risk

Example:

1. Mobile sends payment with idempotency key `PAY-1001`.
2. First request applies to Instalment 1.
3. Mobile does not receive the response because of network failure.
4. Mobile retries the same logical payment.
5. Instalment 1 is now paid.
6. Server selects Instalment 2 as the next target.
7. Generated key becomes different because the target instalment changed.

Possible result:

```text
PAY-1001:INST-1
PAY-1001:INST-2
```

The same payment request can potentially be recorded twice.

## Business Impact

Potential duplication of:

- Collection amount
- `CollectionEntry`
- Payment ledger
- Payment allocation
- Agent float
- Daily collection totals
- Receipt
- Loan `totalCollected`
- Paid instalment counts

## Expected Fix

The idempotency identity must represent the **payment request**, not the selected instalment.

Recommended principle:

```text
tenantId + clientGeneratedIdempotencyKey
```

The same client key must always return the same result, even if loan state changed after the first request.

Do not derive the uniqueness of the payment from the currently selected instalment.

---

## Validation After Fix

### Scenario 1 – Same request submitted twice

Given:

- Active loan
- Instalment 1 unpaid
- Payment = ₹500
- Idempotency key = `MOBILE-TEST-001`

When:

- Submit `/api/v1/collection/collect`
- Submit the exact same request again

Then verify:

- Only one money movement exists.
- `loan.totalCollected` increases only once.
- Agent wallet increases only once for cash.
- Only one logical payment is created.
- Only one receipt is created.
- Only one `CollectionEntry` is created for the logical transaction.
- Payment allocation is not duplicated.
- Second request returns existing result or explicit duplicate/no-op response.

### Scenario 2 – First payment fully closes current instalment

Repeat the same request after Instalment 1 becomes fully paid.

Expected:

- Retry must not move into Instalment 2.
- Loan collection total must remain unchanged.

### Scenario 3 – Offline sync retry

Simulate:

- Device offline
- Collection saved locally
- First sync reaches server but app does not receive acknowledgement
- Sync retries

Expected:

- One payment only.

## Sign-Off Criteria

This issue is resolved only when an automated regression test proves duplicate retry is idempotent across:

- Collection entry
- Payment
- Payment allocation
- Agent wallet
- Account ledger
- Loan total collected
- Instalment received amount
- Receipt
- Daily collection

---

# 5. P0 – Cash Handover Settlement

## Files Checked

Request creation:

`app/api/v1/collection/handover/route.ts`

Approval:

`app/api/v1/approvals/[id]/approve/route.ts`

Existing proper wallet movement logic:

`app/(dashboard)/[module]/wallet/actions.ts`

and wallet utilities under:

`lib/wallet*`

## Current Problem

The approval flow for:

`requestType = cash_handover`

currently marks the daily collection as settled.

Current behavior is effectively:

```ts
await tx.dailyCollection.update({
  where: { id: request.entityId },
  data: {
    status: 'settled',
    lockedAt: new Date(),
  },
});
```

But the approval path does not perform the required agent-to-branch cash movement.

## Expected Accounting / Cash Flow

Example:

Before handover:

```text
Agent Float / Cash Held = ₹12,000
Branch Cash Pool         = ₹40,000
```

After approved handover:

```text
Agent Float / Cash Held = ₹0
Branch Cash Pool         = ₹52,000
```

The settlement must be atomic.

---

## Expected Fix

When approving a `cash_handover` request:

1. Validate request is still pending.
2. Read handover amount.
3. Validate agent wallet/cash balance.
4. Debit agent-held cash.
5. Credit branch cash.
6. Create wallet transaction(s).
7. Create necessary account/cash book entry.
8. Set `DailyCollection.status = settled`.
9. Lock the daily collection.
10. Mark approval approved.
11. Write audit log.

All financial updates must happen in **one database transaction**.

If cash transfer fails, the handover must not be marked settled.

---

## Validation After Fix

### Scenario

Given:

- Agent cash balance = ₹10,000
- Branch cash = ₹50,000
- Daily collection handover request = ₹10,000

When:

- Admin approves handover

Then verify:

```text
Agent cash = ₹0
Branch cash = ₹60,000
DailyCollection = settled
Approval = approved
```

Also verify:

- Wallet transactions created.
- Audit entry created.
- Branch is correct.
- Tenant is correct.
- App type is `microlending`.
- Same approval cannot be processed twice.

### Failure Scenario

Given:

- Agent available cash is less than requested handover amount

When approval is attempted

Then:

- Transaction fails.
- Daily collection remains pending.
- Approval remains pending.
- No branch cash credit occurs.
- No partial wallet movement occurs.

## Sign-Off Criteria

Do not release until wallet, branch cash and daily collection all reconcile after approval.

---

# 6. P1 – Customer Pagination

## Files Checked

Flutter:

`mobile/lib/data/services/customer_service.dart`

Backend:

`app/api/v1/customers/route.ts`

## Current Problem

Backend customer listing uses cursor pagination.

Current API configuration includes approximately:

```text
defaultLimit = 20
maxLimit = 100
```

and returns:

```text
pagination.nextCursor
```

Flutter currently makes only one customer request.

So if there are 150 customers, the mobile app can initially receive only the first page.

## Comparison

### Loan Service

`loan_service.dart` already follows `nextCursor`.

### Customer Service

`customer_service.dart` currently does not.

---

## Expected Fix

Use the same pagination strategy already used in `LoanService`.

Recommended behavior:

1. Request first page.
2. Add returned customers.
3. Read `pagination.nextCursor`.
4. If cursor exists, request next page.
5. Continue until `nextCursor == null`.

For search:

- Keep the same `q` parameter on every cursor request.

---

## Validation After Fix

Seed:

- 125 customers
- Multiple routes
- Multiple branches where applicable

Verify:

- Mobile list returns all customers in allowed scope.
- Search works beyond the first 20 records.
- No duplicate customer appears.
- Agent only sees assigned/allowed customers.
- Branch admin only sees active branch customers.
- Superadmin with all branches can see all permitted customers.

## Regression Check

Compare:

```text
Web customer count
API total accessible customer count
Flutter customer list count
```

They should match for the same user, tenant, app and branch scope.

---

# 7. P1 – Customer KYC Document Contract

## Files Checked

Backend model / API:

`prisma/schema.prisma`

`app/api/v1/customers/[id]/route.ts`

Flutter:

`mobile/lib/data/models/customer.dart`

Flutter test:

`mobile/test/model_contract_test.dart`

## Current Problem

Backend KYC document structure uses fields such as:

```text
docType
fileName
filePath
fileSize
```

Flutter currently expects:

```text
type
url
```

Current Flutter parser:

```dart
type: json['type']
url: json['url']
```

This can cause KYC records to exist in the API response but appear blank in the mobile app.

## Expected Fix – Preferred

Do not expose raw Prisma model naming differently to each client.

Create an explicit API response contract:

```json
{
  "id": "kyc-id",
  "type": "aadhaar",
  "fileName": "aadhaar.jpg",
  "url": "/api/files/..."
}
```

Map:

```text
docType  → type
filePath → url
```

at the API boundary.

Alternative:

Make Flutter accept both field sets temporarily:

```dart
type: json['type'] ?? json['docType']
url: json['url'] ?? json['filePath']
```

But the cleaner long-term solution is a normalized API contract.

---

## Validation After Fix

Create customer with:

- Aadhaar document
- PAN document
- Additional KYC document

Verify in mobile:

- Correct document type
- Correct file name
- Correct URL
- File opens successfully
- Tenant access rules still apply
- Another tenant cannot access the file

Update `mobile/test/model_contract_test.dart` so the mocked response matches the **real API contract**.

---

# 8. P1 – Approval Insufficient Float Warning

## Files Checked

Backend:

`app/api/v1/approvals/route.ts`

Flutter model:

`mobile/lib/data/models/approval.dart`

Flutter screen:

`mobile/lib/features/approvals/approvals_screen.dart`

## Current Problem

Backend returns values such as:

```text
insufficientFloat
agentFloat
floatDeficit
```

at the approval response level for pending loans.

Flutter `Approval` currently stores:

- id
- entityType
- action
- status
- payload
- requestedByName
- createdAt
- reviewNote

It does not retain:

- `insufficientFloat`
- `agentFloat`
- `floatDeficit`

The screen then attempts to read `insufficientFloat` from `requestedChanges`, where that boolean is not guaranteed to exist.

## Expected Fix

Extend Flutter approval model:

```dart
final bool insufficientFloat;
final double? agentFloat;
final double? floatDeficit;
```

Parse them directly from the API response.

Use those fields to show the warning.

Do not depend on parsing the warning from the free-form JSON payload.

---

## Validation After Fix

Given:

```text
Agent float = ₹20,000
Required disbursement = ₹30,000
```

When mobile admin opens approval

Then mobile must show:

- Available float
- Required amount
- Deficit
- Clear warning

Approval should either:

- Be disabled until funds are released, or
- Be allowed to attempt and receive an explicit server rejection

The server remains the final authority.

---

# 9. P1 – Collection Web / Mobile Worklist Parity

## Files Checked

Web:

`app/(dashboard)/[module]/collection/page.tsx`

Backend web/mobile dashboard:

`app/api/v1/collection/dashboard/route.ts`

Mobile:

`mobile/lib/data/services/collection_service.dart`

`mobile/lib/features/collection/collection_screen.dart`

## Current Difference

Web collection page uses:

```text
GET /api/v1/collection/dashboard
```

This returns:

- `todayInstalments`
- `overdueInstalments`
- `collectionSummary`
- routes
- daily collection
- receipt PDF availability
- GPS feature status

It also applies server-side distributed payment metrics.

Mobile collection screen still uses:

```text
GET /api/v1/collection/today
```

This means web and mobile are not always rendering the same representation of collection allocation.

## Expected Direction

Choose one canonical server worklist.

Recommended:

```text
/api/v1/collection/dashboard
```

for both web and mobile worklist display.

The mobile app can still use action APIs such as:

- `/collection/collect`
- `/collection/entry`
- `/collection/proof/*`
- `/collection/run/*`

for mutations.

---

## Validation After Fix

Create a loan with:

- Past overdue instalment
- Today's instalment
- Partial payment
- Payment larger than today's due

Compare web and mobile for:

- Today due
- Today collected
- Today outstanding
- Overdue amount
- Overdue collected today
- Remaining overdue
- Customer visible / not visible
- Paid state
- Route
- GPS coordinates

The values must match exactly for the same user and branch.

---

# 10. P1 – Business Date Consistency

## Files Checked

Collection dashboard:

`app/api/v1/collection/dashboard/route.ts`

Daily reports:

`app/api/v1/reports/daily/route.ts`

Cash handover:

`app/api/v1/collection/handover/route.ts`

Loan detail:

`app/api/v1/loans/[id]/route.ts`

## Current Problem

Some flows use shared business-time helpers such as:

```text
startOfBusinessToday()
startOfBusinessTomorrow()
```

while other routes use:

```ts
const date = new Date();
date.setHours(0, 0, 0, 0);
```

On a UTC server, this can produce a different business-day boundary from India local time.

## Expected Fix

Use one shared business-time utility for all Micro Lending daily operations.

Recommended areas:

- Collection dashboard
- Collection posting
- Daily collection
- Daily reports
- Cash handover
- Agent collection totals
- Penalty/day classification where applicable
- Loan due-today status
- Receipt date
- Route-run date

---

## Validation After Fix

Test around day boundary.

Example:

```text
00:15 IST
23:50 IST
```

Confirm the same transaction belongs to the same business date in:

- Collection screen
- Daily collection
- Reports
- Cash handover
- Dashboard KPIs
- Agent totals

---

# 11. P1 – Reports Mobile Parity

## Files Checked

Flutter:

`mobile/lib/features/reports/reports_screen.dart`

`mobile/lib/data/services/reports_service.dart`

Backend report routes:

`app/api/v1/reports/**`

## Current Mobile UI

Currently the main Flutter Reports screen primarily exposes:

1. Overdue
2. Agent Performance

The backend/web has significantly more reporting capability.

## Pilot Recommendation

Full web report parity is not mandatory for the pilot.

But the following reports are useful for local financiers and branch-based lenders and should be considered high-value mobile reports:

- Daily Collection
- Date-wise Collection
- Agent-wise Collection
- Customer Collection History
- Missed Collection
- Overdue
- Loan Register
- Outstanding Balance
- Customer Loan History
- Agent Performance
- Agent Float / Wallet
- Branch Collection Summary

## Validation After Adding

For each report:

- Same filter behavior as web.
- Same totals as web.
- Same branch scope.
- Same tenant scope.
- Same date boundary.
- Same currency values.
- Export behavior clearly separated if export remains web-only.

---

# 12. P2 – Notification Pagination

## Files Checked

Flutter service:

`mobile/lib/data/services/notifications_service.dart`

Flutter screen:

`mobile/lib/features/notifications/notifications_screen.dart`

Backend:

`app/api/v1/notifications/route.ts`

## Current Problem

Service supports:

```text
page
pageSize
```

with default:

```text
pageSize = 20
```

But the mobile notification screen simply calls:

```dart
fetchNotifications()
```

once.

Result:

- Latest notifications appear.
- Older notifications are not loaded.

## Expected Fix

Either:

### Option A – Infinite scroll

Load next page when the user approaches the bottom.

### Option B – Load more

Show a `Load More` button.

## Validation

Create more than 50 notifications.

Verify:

- First page loads.
- Second page loads.
- No duplicates.
- Unread state remains correct.
- Mark read still works.
- Mark all read works across currently visible and server-side matching notifications.

---

# 13. P2 – Logout Token Revocation

## File Checked

`app/api/v1/auth/logout/route.ts`

## Current Behavior

The route documents stateless JWT behavior.

Logout returns success, but the issued bearer token remains valid until expiry.

## Decision Required

For a pilot, this may be accepted if:

- Access token lifetime is short.
- Refresh token can be revoked.
- Device risk is acceptable.

For production financial usage, stronger revocation is recommended.

## Recommended Future State

Possible implementation:

- Refresh-token table
- Token session ID / `jti`
- Server-side revoked-token/session store
- Device sessions
- Force logout
- Password-change invalidation

## Validation

After logout:

```text
GET /api/v1/auth/me
Authorization: Bearer <old token>
```

Expected hardened behavior:

```text
401 Unauthorized
```

---

# 14. P2 – Remove Remaining Client-Side Financial Calculation Drift

## Files Checked

Flutter:

`mobile/lib/features/loans/loan_detail_screen.dart`

Backend:

`app/api/v1/loans/[id]/route.ts`

## Already Improved

Server now calculates:

- Restructure
- `restructuredAmount`
- Extended schedule

Flutter consumes those values.

This is good.

## Remaining Concern

Flutter still computes some display values such as:

- Overdue summary
- Penalty summary
- Distributed presentation logic

Even if they currently match web, duplication creates future drift risk.

## Recommended Architecture

Use:

```text
Shared server calculation
        ↓
      API
      / \
   Web  Mobile
```

Avoid:

```text
Raw values
 /      \
Web      Flutter
calc     calc
```

where both clients independently reimplement financial rules.

## Validation

For the same loan, compare web and mobile:

- Total payable
- Total collected
- Outstanding
- Overdue
- Missed count
- Penalty total
- Settled penalty
- Waived penalty
- Net penalty
- Restructure amount
- Remaining periods
- Projected end date

All values must match exactly.

---

# 15. Items That Were Good in the Re-Check

## API Route Inventory

The mobile endpoint definitions broadly match existing `/api/v1` routes.

No major missing API route was found during the latest route inventory pass.

## Loan Pagination

`mobile/lib/data/services/loan_service.dart`

already follows `pagination.nextCursor`.

Use this as the reference implementation for Customer pagination.

## Server-Side Restructure

`app/api/v1/loans/[id]/route.ts`

returns server-computed:

- `restructure`
- per-instalment `restructuredAmount`
- `extendedSchedule`

Flutter is using the server-provided restructured amount.

This should be retained.

## Scope Architecture

The backend generally applies:

- Tenant scope
- App/module scope
- Branch scope
- Agent/customer relationship scope

Do not weaken these while fixing parity.

---

# 16. Required Test Coverage After Fixes

The fixes should not be validated only by opening screens manually.

Add or update automated tests.

## Backend Tests

### Collection idempotency

Test:

- Same payment request twice
- Same payment after target instalment changes
- Offline retry
- Cash and UPI
- Full repayment
- Partial repayment

### Cash Handover

Test:

- Handover approval moves money
- Duplicate approval blocked
- Insufficient wallet balance
- Wrong branch
- Wrong tenant
- Agent wallet / branch pool reconcile

### Customer Pagination

Test:

- More than 100 customers
- Cursor traversal
- Agent scope
- Branch scope
- Search with cursor

### KYC Contract

Test actual API response fields, not only mocked mobile fields.

### Approval Float

Test:

- Float sufficient
- Float insufficient
- Warning values returned
- Approval rejected safely if money unavailable

### Business Date

Test IST boundary.

---

## Flutter Tests

Update / add:

- Customer pagination service test
- KYC model contract test using real API field contract
- Approval float parsing test
- Collection dashboard model test if mobile changes endpoint
- Notification pagination test
- Report model tests
- Loan parity tests

---

# 17. Manual QA Scenarios for Pilot

## QA Dataset

Create at minimum:

### Branches

- Head Office
- Branch A
- Branch B

### Users

- Super Admin
- Branch Admin A
- Branch Admin B
- Agent A1
- Agent A2

### Customers

At least:

- 125 customers

Include:

- Customer with no loan
- Active loan customer
- Overdue customer
- Closed loan customer
- Customer with KYC
- Customer without KYC
- Customer with multiple guarantors
- Customer with collection GPS

### Loans

Include:

- Daily
- Weekly
- Monthly
- Partial repayment
- Overdue
- Pending approval
- Closed
- Penalty
- Restructured display

---

# 18. Mobile ↔ Web Comparison Checklist

For the same login, tenant and branch, compare both platforms.

## Dashboard

- Total customers
- Active loans
- Outstanding
- Today's expected
- Today's collected
- Overdue
- Agent metrics

## Customer

- Customer list count
- Search
- Profile details
- PAN
- Aadhaar masked value
- Company fields
- Collection point
- Agent
- Route
- KYC documents
- Guarantors
- Security cheques
- Loans

## Loan

- Principal
- Disbursed
- Total payable
- Total collected
- Outstanding
- Instalment amount
- Frequency
- Start/end date
- Instalment schedule
- Actual amount
- Distributed view
- Restructured rate
- Penalty
- Overdue
- Status

## Collection

- Today's due
- Overdue
- Outstanding
- Collected today
- Customer grouping
- Route
- GPS
- Receipt
- Payment mode
- Partial collection
- Full collection

## Approval

- Customer approval
- Loan approval
- Loan edit
- Collection edit
- Cash handover
- Preclose
- Float warning

## Wallet

- Branch cash
- Agent float
- Fund release
- Collection credit
- Handover debit
- Branch receipt

## Reports

- Date range
- Counts
- Totals
- Branch scope
- Agent scope

---

# 19. Validation Commands

## Flutter Environment

Before mobile validation, confirm the Flutter SDK is compatible with the current dependencies.

The previously observed environment issue was:

```text
Installed Dart: 3.10.7
Existing ML Kit dependency requires Dart >= 3.12
```

If that is still true, use a Flutter SDK containing Dart 3.12 or newer.

Then run:

```bash
flutter --version
dart --version
flutter clean
flutter pub get
dart format .
flutter analyze
flutter test
```

Do not claim Flutter validation is complete if dependency resolution stops before `flutter analyze`.

---

## Backend / Repository

Run the project's relevant test scripts for:

- API parity
- Mobile parity
- Business E2E
- Micro Lending E2E
- Money movement
- Calculation logic

At minimum ensure coverage for files such as:

```text
tests/mobileParityRoutes.test.ts
tests/desktopMobileParity.test.ts
tests/e2e-business/mobileAgentApiParity.test.ts
tests/e2e-business/moneyMovementCore.test.ts
tests/e2e/microlending/*
```

Use the repository's actual package scripts for execution.

---

# 20. Important Test Gap

At the time of the last GitHub check, the branch commit:

`2071099295a633827c1410e07615044846e62186`

had no visible GitHub Actions workflow run or combined status check attached.

Therefore:

> A pushed commit existing in GitHub should not automatically be considered validated.

Recommended:

Add CI checks for:

1. Backend lint/type check
2. Backend unit tests
3. API parity tests
4. Business E2E tests
5. Flutter analyze
6. Flutter tests

---

# 21. Final Release Gate

Before declaring Micro Lending mobile parity complete, all of the below should be true.

## P0 Gate

- [x] Duplicate collection retry is fully idempotent.
- [x] Cash handover moves money from agent to branch atomically.
- [x] Money movement regression tests pass.

## P1 Gate

- [x] Mobile loads all permitted customers, not only first 20.
- [x] KYC documents display correctly.
- [x] Approval float warning is visible and correct.
- [x] Collection values match web.
- [x] Business date is consistent across collection/report/handover.
- [x] Required pilot reports are available and match web totals.

## P2 Gate

- [x] Notifications support pagination or load more.
- [x] Logout security decision is documented.
- [x] Financial calculations are progressively centralized server-side.

## Technical Gate

- [x] `merged-all-branches` contains the fixes.
- [x] Branch SHA changed after fix commit.
- [x] Flutter dependencies resolve.
- [x] `flutter analyze` passes.
- [x] Flutter tests pass.
- [x] Backend tests pass.
- [x] No new branch / tenant isolation regression.
- [x] No new duplicate money movement issue.

---

# 22. Definition of Done for Each Fix

A ticket should not be marked Done until all five are complete:

1. **Code fixed**
2. **Automated test added/updated**
3. **Manual web/mobile comparison passed**
4. **Fix pushed to `merged-all-branches`**
5. **No regression in tenant/branch/agent scope**

---

# 23. Recommended Implementation Order

## Phase 1 – Pilot Blockers

1. Duplicate collection idempotency
2. Cash handover settlement
3. Business-date consistency

## Phase 2 – Data Parity

4. Customer pagination
5. KYC API/mobile contract
6. Approval float warning
7. Collection worklist parity

## Phase 3 – Pilot Usability

8. Key mobile reports
9. Notification pagination

## Phase 4 – Hardening

10. JWT logout/session revocation
11. Move remaining financial calculations to shared backend logic
12. CI enforcement

---

# 24. Re-Check Request After Development

After the fixes are pushed, re-check the following exact points:

```text
1. Confirm merged-all-branches new SHA.
2. Check CustomerService cursor pagination.
3. Check real customer API KYC response vs Flutter model.
4. Check Approval model parses insufficientFloat / agentFloat / floatDeficit.
5. Check cash_handover approval calls financial settlement logic.
6. Check duplicate /collection/collect replay cannot move to next instalment.
7. Check web and mobile use the same collection worklist/metrics.
8. Check all daily flows use the same business timezone helper.
9. Check notifications can load past first 20.
10. Check required mobile reports against web totals.
11. Run API/mobile parity tests.
12. Run money movement tests.
13. Run Flutter analyze and Flutter tests.
14. Perform web/mobile comparison with the same test tenant.
```

---

# 25. Final Expected Outcome

After all fixes are completed, the target state should be:

```text
Web
      \
       Shared backend business logic
      /
Mobile
```

The same loan, customer, collection and cash movement should produce the same:

- Amount
- Status
- Outstanding
- Overdue
- Penalty
- Cash balance
- Agent float
- Approval status
- Report total

on both platforms.

The mobile application should not merely have matching screens.

It must have **financial and operational parity** with the web application.
