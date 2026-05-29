# 09 · Penalties & Approvals

## Penalties
### Web
- List with status filters; **settle** and **waive** (partial/full) with notes; penalty accrual via `lib/penalties.ts`.
### Mobile
- `penalties/penalties_screen.dart` (~552) + `penaltyServiceProvider`; v1 `GET /penalties`, `POST /penalties/[id]/settle`.
### Gaps
1. ❌ **Waive** action (web supports waive; mobile only settle).
2. 🟡 Status/customer/date filters parity.
### API needed
- `POST /api/v1/penalties/[id]/waive` (amount, notes). *(new v1 endpoint)*

## Approvals
### Web
- Queue across **all request types**: customer create/edit, collection edit, cash handover, loan edits, branch/module requests; approve/reject with notes.
### Mobile
- `approvals/approvals_screen.dart` (~348) + v1 `GET /approvals`, `POST /approvals/[id]/approve`, `/reject`.
### Gaps
1. 🟡 Confirm **all request types render** with correct before/after diffs (esp. customer_edit, collection edit).
2. 🟡 Reviewer notes on approve/reject.

## Acceptance
- Penalty waive works on mobile; approvals show every web request type with diffs and notes.

> **Needs line-by-line verification** of both screens.
