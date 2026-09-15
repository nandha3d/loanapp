# ZoloFund Automation Test Sketch — Security, Abuse, ID Tampering, PII Protection

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

Implement automated security regression tests for missing/invalid tokens, role abuse, branch/tenant ID tampering, file access, PII masking, SQL/XSS-style input, rate limits, password reset, audit logs, and dangerous actions.

## Source areas Codex should inspect first

- `middleware.ts`
- `lib/api/v1-auth.ts`
- `lib/access.ts`
- `lib/rateLimit.ts if present`
- `lib/pii.ts`
- `app/api/files/[...path]/route.ts`
- `app/api/v1/auth/forgot-password/route.ts`
- `app/api/v1/auth/reset-password/route.ts`
- `app/api/v1/upload/route.ts`
- `tests/security.test.ts`
- `prisma/schema.prisma`

## Automation test cases to implement

| ID | Test case | Main assertion | Type |
|---|---|---|---|
| SEC-001 | Missing token on protected APIs | 401 returned | API |
| SEC-002 | Malformed token | 401 returned | API |
| SEC-003 | Agent calls admin/developer API | 403 returned | API |
| SEC-004 | Agent approves loan by endpoint call | 403 and DB unchanged | API + DB |
| SEC-005 | Branch ID tampering on customer detail | 403/404 and no data leakage | API |
| SEC-006 | Tenant ID tampering on loan detail | 403/404 and no data leakage | API |
| SEC-007 | Report tenant leakage attempt | Other tenant rows absent | API + DB |
| SEC-008 | KYC file public URL access | Blocked unless authorized | API |
| SEC-009 | Aadhaar/PAN masking | Sensitive data encrypted/masked in responses | API + DB |
| SEC-010 | SQL injection-style query | No crash/no broad data leakage | API |
| SEC-011 | XSS string in customer name | Stored/rendered safely; no executable script in response/UI | API/UI optional |
| SEC-012 | Login rate limit | Excess attempts blocked if rate limit exists | API + DB |
| SEC-013 | Password reset token expiry/reuse | Expired/reused token rejected | API + DB |
| SEC-014 | Audit log for money/approval actions | Sensitive actions logged | DB |

## Implementation sketch for Codex

1. Reuse the auth seed scenario with two tenants and two branches.
2. For every sensitive endpoint, try ID tampering using valid token from wrong role/branch/tenant.
3. Assert status code and response body does not contain forbidden entity name, phone, amount, or ID.
4. Add helper `expectNoSensitiveLeak(responseText, forbiddenValues)`.
5. For file access, create a fake KYC upload and test authorized owner/admin vs unrelated agent/tenant.
6. For PII, assert raw Aadhaar/PAN is not returned in list/detail/report responses if the app has masking/encryption rules.
7. SQL/XSS tests should not attempt destructive payloads; use harmless strings such as `<script>alert(1)</script>` and `%' OR '1'='1`.
8. Do not use external security scanners in this suite; keep it as deterministic regression tests.

## Manual verification still needed

Manual penetration-style review is still needed before production, especially for browser session handling, headers, file storage permissions, and real deployment configuration.

## Acceptance criteria

- Unauthorized users cannot read or mutate protected data by changing IDs.
- Sensitive files and PII are protected.
- Dangerous inputs do not crash or leak data.
- Sensitive business actions produce audit logs.

## Suggested npm script

```json
"test:e2e-security-abuse": "tsx tests/e2e-business/securityAbuse.test.ts"
```
