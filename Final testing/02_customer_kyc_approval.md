# ZoloFund Automation Test Sketch — Customer, KYC, Guarantor, Approval Flow

This Markdown file is written as a direct implementation sketch/prompt for Codex.

## Project context Codex must use

- App stack: Next.js app router + TypeScript + Prisma + MySQL.
- Existing API style: `/api/v1/...` routes return the shared v1 envelope through `ok()` / `fail()`.
- Existing database models include: `Tenant`, `Branch`, `User`, `Customer`, `LoanPackage`, `Loan`, `Instalment`, `DailyCollection`, `CollectionEntry`, `AccountEntry`, `WalletTransaction`, `BranchCashAccount`, `AgentAccount`, `CashHandover`, `ApprovalRequest`, `Penalty`, `NpaHistory`, `LoanProvisioning`, `GoldLoanCollateral`, `Payment`, `PaymentAllocation`, `NachMandate`, `NachPresentation`, `AuditLog`.
- Existing package scripts already include several `tsx` test scripts and Playwright setup. Add new tests without breaking existing scripts.
- Prefer API + DB tests for business correctness. Use Playwright only where UI behaviour must be verified.
- Do not depend on production data. Use a dedicated QA/test database from `DATABASE_URL`.

## Common implementation rules

1. Create deterministic seed helpers for tenant, branches, users, customers, packages, loans, and opening cash.
2. Every test must clean up its own data or use unique IDs/slugs using a timestamp/test prefix.
3. Every money test must assert all four layers where applicable: API response, DB row, ledger/wallet row, and report/API summary.
4. Use idempotency keys for payment/collection tests.
5. Assert tenant isolation and branch isolation for every read/list API that returns business data.
6. Add clear npm scripts for each test file.
7. Keep tests independent; one failed test should not corrupt the next test.

## Suggested shared helper files

Codex can create helpers similar to these:

```text
tests/helpers/testDb.ts
tests/helpers/apiClient.ts
tests/helpers/seedZoloFund.ts
tests/helpers/assertMoney.ts
tests/helpers/authTokens.ts
tests/helpers/cleanup.ts
```

The helper names can be adjusted after inspecting the repository, but keep the same responsibilities.


## Objective

Implement automated tests for customer onboarding from web/mobile APIs, duplicate prevention, KYC upload/review, guarantor handling, geocode capture, and approval/rejection workflow.

## Source areas Codex should inspect first

- `app/api/v1/customers/route.ts`
- `app/api/v1/customers/[id]/route.ts`
- `app/api/v1/kyc/queue/route.ts`
- `app/api/v1/kyc/[customerId]/review/route.ts`
- `app/api/v1/upload/route.ts`
- `app/api/approvals/route.ts`
- `app/api/approvals/[id]/review/route.ts`
- `lib/pii.ts`
- `lib/audit.ts`
- `prisma/schema.prisma`

## Automation test cases to implement

| ID | Test case | Main assertion | Type |
|---|---|---|---|
| CUST-001 | Admin creates customer | Customer created active/valid status with tenant/branch/appType | API + DB |
| CUST-002 | Agent creates customer | Customer created with pending/review status when approval rule applies | API + DB |
| CUST-003 | Admin approves agent customer | Status changes to approved/active and audit log exists | API + DB |
| CUST-004 | Admin rejects customer | Status becomes rejected and cannot be used for loan | API + DB |
| CUST-005 | Duplicate phone blocked | Second create fails safely | API |
| CUST-006 | Duplicate identity blocked if rule exists | Second Aadhaar/PAN fails or is flagged as per business rule | API + DB |
| CUST-007 | Update allowed fields | Only allowed fields change | API + DB |
| CUST-008 | Agent cannot update restricted approved fields | Returns 403/400 and DB unchanged | API + DB |
| CUST-009 | KYC document upload valid file | KycDocument row created and linked | API + DB |
| CUST-010 | KYC unsupported file rejected | No document row created | API + DB |
| CUST-011 | Guarantor creation | Guarantor linked to customer/loan context | API + DB |
| CUST-012 | Customer geocode save | CustomerGeocode row saved with coordinates | API + DB |
| CUST-013 | Search by name/phone/code | Expected customer returned, unrelated customer excluded | API |
| CUST-014 | Branch/tenant list scope | Customer list cannot leak other branch/tenant records | API + DB |

## Implementation sketch for Codex

1. Add seed helper for tenant, branch, admin, manager, agent, and approval settings.
2. Implement customer API tests using token-based API client.
3. For duplicate tests, create a customer once, then repeat with same phone/Aadhaar/PAN.
4. For KYC upload, use small fixture files under `tests/fixtures/` and verify storage metadata only; do not rely on external storage.
5. For PII, assert raw Aadhaar is not exposed in GET/list responses if masking/encryption exists in the app.
6. For approval, inspect the app's existing approval flow and use the correct approval endpoint/model (`ApprovalRequest` if applicable).
7. Write DB assertions for `Customer`, `KycDocument`, `Guarantor`, `CustomerGeocode`, `AuditLog`, and notification logs if generated.
8. Add negative tests for missing required fields, invalid phone format, wrong branch, and wrong tenant.

## Manual verification still needed

Manually verify customer form field order, error message wording, photo upload UX, KYC document preview, and whether business users understand the approval screen.

## Acceptance criteria

- Customer onboarding works for admin and agent roles.
- Duplicate and invalid data are blocked.
- KYC and guarantor records are linked correctly.
- Agent-created customer approval/rejection is auditable.
- Customer lists and detail APIs respect branch and tenant scope.

## Suggested npm script

```json
"test:e2e-customers": "tsx tests/e2e-business/customerKycApproval.test.ts"
```
