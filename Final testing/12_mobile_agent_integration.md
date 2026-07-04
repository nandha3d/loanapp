# LoanTrack Automation Test Sketch — Mobile Agent Integration, Offline Sync, GPS, API Parity

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
tests/helpers/seedLoanTrack.ts
tests/helpers/assertMoney.ts
tests/helpers/authTokens.ts
tests/helpers/cleanup.ts
```

The helper names can be adjusted after inspecting the repository, but keep the same responsibilities.


## Objective

Implement automated tests for mobile agent API parity and Flutter integration flows: login, dashboard, customers, loans, collection submission, offline queue, sync, GPS metadata, wallet view, and role restrictions.

## Source areas Codex should inspect first

- `mobile app source if present in repository`
- `app/api/v1/auth/login/route.ts`
- `app/api/v1/customers/route.ts`
- `app/api/v1/loans/route.ts`
- `app/api/v1/collection/collect/route.ts`
- `app/api/v1/wallet/me/route.ts`
- `app/api/v1/gps/ping/route.ts`
- `app/api/v1/fcm-token/route.ts`
- `scripts/mobileDesktopParityAudit.test.ts`
- `prisma/schema.prisma`

## Automation test cases to implement

| ID | Test case | Main assertion | Type |
|---|---|---|---|
| MOB-001 | Agent mobile login | Token stored and agent dashboard reachable | Flutter/API |
| MOB-002 | Invalid login | Error shown and no token stored | Flutter/API |
| MOB-003 | Customer list API parity | Mobile list matches scoped API data | API + DB |
| MOB-004 | Loan list API parity | Mobile list matches agent-accessible loans | API + DB |
| MOB-005 | Collection submit online | Backend collection/wallet updated | Flutter/API + DB |
| MOB-006 | Offline collection save | Local queue row/item stored | Flutter integration |
| MOB-007 | Offline sync after network returns | Exactly one backend collection created | Flutter/API + DB |
| MOB-008 | Duplicate offline sync prevented | No double CollectionEntry | Flutter/API + DB |
| MOB-009 | GPS allowed | Latitude/longitude metadata saved | Flutter/API + DB |
| MOB-010 | GPS denied | Handled according to settings without crash | Flutter |
| MOB-011 | Wallet balance view | Mobile wallet value matches DB/API | Flutter/API + DB |
| MOB-012 | Agent cannot see admin modules | Screens/menu absent and API 403 | Flutter/API |
| MOB-013 | Push token registration | DeviceToken row upserted | API + DB |
| MOB-014 | Logout | Token cleared and protected screens blocked | Flutter |

## Implementation sketch for Codex

1. If Flutter source is included, add/extend `integration_test/loantrack_agent_flow_test.dart`. If only APK is present, create backend mobile API parity tests first and document manual APK testing separately.
2. Build API parity tests using `/api/v1/...` routes consumed by mobile.
3. Use fake/mock connectivity layer in Flutter integration tests for offline/online transition if available.
4. For local queue, inspect mobile storage implementation and assert queued item count before/after sync.
5. For GPS, use mocked coordinates in integration tests and real-device manual test separately.
6. Assert backend DB after mobile actions: `CollectionEntry`, `Instalment`, `Loan`, `WalletTransaction`, `AgentLocationPing`, `DeviceToken`.
7. Add contract tests that validate response shape expected by mobile screens.
8. Keep tests independent of physical device sensors unless running manual/device lab.

## Manual verification still needed

Manual real Android testing is required for APK install, GPS accuracy, camera upload, push notification display, background/foreground behaviour, network switching, and low-end device performance.

## Acceptance criteria

- Mobile online collection changes the same backend records as web/API collection.
- Offline sync is idempotent.
- Mobile data is scoped to the agent.
- GPS and push registration paths do not crash and save expected metadata.

## Suggested npm script

```json
"test:e2e-mobile-api": "tsx tests/e2e-business/mobileAgentApiParity.test.ts"
```
