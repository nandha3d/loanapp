# 02 · Loans

## Web scope
- List: search, **status filter (+ closed toggle requested)**, frequency filter, **sortable headers**, customer avatar+name, **Paid column**, progress, pagination.
- Detail: schedule (Actual/Distributed views), **Show Restructured Rate**, calendar tracker, penalties, payments, **close / renew / pre-close / foreclosure**, security cheques, statement (PDF).
- **Edit** loan (`loans/[id]/edit`).
- Create: full calculator (deduction types, frequency, dueDay, penalty, collateral, guarantor, cheques).

## Mobile current
- List (`loans_screen.dart`) — now: avatar, Paid/progress edge bar, closed toggle, all loans (cursor paging followed).
- Detail (`loan_detail_screen.dart`) — schedule, Actual/Distributed, restructure (now fixed), pay per instalment, calendar tracker, borrower header.
- Create (`new_loan_screen.dart`).

## Gaps
1. ❌ **Loan edit** — no mobile screen; web has `loans/[id]/edit`. Needs a v1 PATCH.
2. ❌ **Close / renew / pre-close / foreclosure** actions.
3. ❌ **Loan statement / receipt PDF** access from mobile detail.
4. 🔢 **Restructured rate** computed in Dart — must move to API ([11](11-calculations-and-architecture.md#b-restructured-instalment-rate--needs-api-move-️-p0)).
5. 🟡 List sort options (web has sortable headers) — mobile has none.

## API needed
- `PATCH /api/v1/loans/[id]` — edit allowed loan fields (admin) / approval request (agent).
- `POST /api/v1/loans/[id]/close`, `/renew`, `/preclose` (mirror web server actions) — **new v1 endpoints only**.
- `GET /api/v1/loans/[id]/statement` (or reuse `/api/receipts/[entryId]` with bearer) for PDF.
- Extend `GET /api/v1/loans/[id]` to include `restructuredAmount` per instalment.
- Optional: `?sort=&dir=` on `GET /api/v1/loans`.

## Acceptance
- Mobile can edit a loan's editable fields and run close/renew/pre-close like web.
- Restructure figures come from the API and match web exactly.
