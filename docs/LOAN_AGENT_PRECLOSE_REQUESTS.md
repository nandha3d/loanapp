# Loan module: agent preclose requests

Date: 13 September 2026

## Delivered behavior

Micro Lending agents can request a full loan settlement from the loan detail page. Admin or superadmin approval records that settlement and closes the loan, following the existing collection-edit pattern where approval applies the requested operation. Approval does not grant permanent preclose permission to the agent.

1. A superadmin enables **Settings → Features → Agent preclose requests (Micro Lending)** and saves.
2. An agent opens an eligible loan belonging to a linked customer and selects **Request loan preclose**.
3. The form shows the current full outstanding amount. The agent selects a payment mode, optionally supplies remarks/reference, and provides a required reason.
4. The request appears under **Approvals → General Requests**. The agent sees that it is pending; the loan and payment records remain unchanged.
5. The existing notification service alerts the loan branch's administrators, the filing agent's branch administrators, and tenant superadmins according to existing notification rules. Notification reach does not grant branch access.
6. An authorized reviewer reads the loan number, amount, payment mode, remarks and reason, then approves or rejects with optional notes.
7. Approval records the existing preclose settlement and closes the loan. Rejection records no payment and leaves the loan unchanged. The agent receives the outcome; rejection notes appear on the loan page and a new request can be submitted.

The existing developer review role also remains available. Existing admin direct preclose remains available regardless of the new feature setting.

## Scope and enablement

| Item | Behavior |
|---|---|
| Application | `microlending` only |
| Setting | `agent_preclose_requests_enabled`; missing/`0` = off, `1` = on |
| Default | Off, following `STABLE-2`; no tenant settings were changed during implementation |
| Eligible loans | Active or overdue loans with a positive outstanding balance, excluding interest-only loans |
| Agent access | Existing customer/route linkage; no blanket branch or tenant access |
| Reviewer access | Existing admin/superadmin/developer roles, restricted to the active branch |
| Amount | Full current `totalPayable - totalCollected`, rounded to paise; no discount or waiver input |
| Payment modes | Cash, UPI, cheque, bank transfer |
| Feature disabled while pending | Approval is blocked; rejection remains available |
| Database migration | None; existing `ApprovalRequest` and `AppSetting` models are reused |
| Dependencies | None added |

No chit fund, gold servicing, property, auto finance or product finance feature receives this agent capability. No module-specific files for those applications were edited. Shared settings and approval surfaces contain narrowly scoped handling for the new Micro Lending request type. Saving settings from another module does not overwrite the new flag.

## Integrity and implementation

- Submission uses the existing `POST /api/v1/approvals` endpoint with `requestType: loan_preclose` and `entityType: loan`. The web form uses a server-action adapter. The direct `POST /api/v1/loans/[id]/preclose` endpoint still rejects agents.
- Both the web approval action and v1 approve/reject handlers call `reviewLoanPrecloseRequest`. The frozen legacy approval API excludes/rejects this new type so it cannot mark a settlement approved without executing it.
- The stored loan is fetched using tenant and module scope. Agent submissions use `buildAgentCustomerAccessWhere`; reviews use the loan's branch through `branchScopeWhere` (`SCOPE-1`–`SCOPE-5`, `SCOPE-15`). Queue counts and the sidebar follow the same new-request visibility.
- An existing pending preclose request blocks another request for that loan. Loan-row locks serialize creation without adding a schema field or changing the loan. Reviews atomically claim only a pending request.
- Approval rechecks loan eligibility and the exact outstanding amount. If collections change the balance or the loan has already closed, approval fails and rolls back. Reject the stale request and submit a fresh one after refreshing the loan.
- Review status, settlement and audit use one transaction (`X-6`, `SEC-2`). Failure leaves the request pending and rolls back the settlement. Notifications occur after commit (`NOTIF-1`, `NOTIF-6`, `NOTIF-9`).
- The original admin settlement body was moved to `lib/loanPreclose.ts` and checked against the original source. Allocation, payment, collection, cash-book and closing logic remain identical. A Micro Lending loan-row lock prevents the new approval path from racing a direct admin preclose; other modules do not take this new lock.
- New form, review and notification copy is translated in English, Tamil, Hindi, Telugu, Kannada and Malayalam. The Flutter UI was not extended; the v1 approval handlers support the new request type for clients that submit it.

## Existing settlement behavior retained

The approved settlement is recorded under the reviewing administrator's collection context, just like an admin performing the existing direct preclose. It does not move funds at request time or attribute the settlement to the agent's cash float.

The existing preclose engine writes Payment, PaymentAllocation, CollectionEntry, DailyCollection, AccountEntry, loan and audit records. It does not currently post a wallet movement or statutory GL journal. This inherited behavior was preserved to respect the requested scope; this work does not certify those existing accounting paths. Penalty, discount, interest-only closure, renewal and ordinary collection logic were not redesigned.

## Validation

| Check | Result |
|---|---|
| `npm run test:calc` before changes | 184/184 passed |
| `npm run test:calc` after changes | 184/184 passed |
| `npm run test:approval-notifications` | Existing notification checks and new preclose workflow checks passed |
| `npm run test:branch-scoping` | Passed |
| `npm run i18n:check` | Passed for all six locales |
| `npm run typecheck` | Passed after regenerating the stale Prisma client from the unchanged schema |
| `npm run i18n:scan` | No increase in literal English candidates in changed/new components |
| `git diff --check` | Passed |

The new runnable checks live in `tests/loanPrecloseRequests.test.ts`, reached through `test:approval-notifications` → `test:ci`. They exercise role/module restrictions, tenant and customer scope, reviewer branch scope including superadmin, exact amounts, required reason, duplicate pending requests, stale balance rollback, settlement failure rollback, rejection/retry, replay denial, notifications after commit, and the unchanged direct-agent denial. Transaction infrastructure and settlement execution are mocked; these checks do not replace a MySQL concurrency test.

Browser smoke verification uses the real request and approval React components with application CSS, synthetic data and mocked server actions. It covers required reason, selected payment mode and submitted amount, pending disablement, rejection notes, review details/approval payload, recoverable submission errors with input preservation, and Tamil copy. No live loan or payment was created during verification.

No local MySQL service was running. Database-backed login-to-settlement testing, MySQL locking under concurrent sessions, and actual push delivery remain unverified. Before enabling this for a live tenant, run the following on a test tenant with a working database:

1. Enable the setting and submit one daily-loan and one weekly-loan request as an agent.
2. Verify the correct branch admin and superadmin can see/review them; another branch cannot.
3. Reject one request and verify no payment/loan change; resubmit it.
4. Approve the other and verify a single settlement, closed status, audit and notification.
5. Retry the approval and race it against direct admin preclose; verify only one settlement commits.
6. Submit another request, record an intervening collection, and verify approval refuses the stale amount.
7. Disable the flag and verify agent submission/approval are blocked while existing admin direct preclose remains available.

## Main code locations

- `lib/loanPreclosePolicy.ts`: pure eligibility and amount checks; request/flag constants.
- `lib/loanPrecloseRequests.ts`: request/review workflow, scope, audits and notifications.
- `lib/loanPreclose.ts`: shared existing settlement implementation.
- `app/(dashboard)/[module]/loans/[id]/LoanPrecloseRequest.tsx`: agent form and request status.
- Loan detail page/actions, settings feature tab, approval page/actions/API, and approval counts: narrow integration points.
- `ENGINEERING_REFERENCE.md`: `PRECLOSE-1` through `PRECLOSE-5` document the new invariants.

No deployment, commit, migration or production feature enablement was performed.
