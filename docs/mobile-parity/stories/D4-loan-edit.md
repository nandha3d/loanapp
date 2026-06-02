# D4 — Loan Edit (mobile)

**Priority:** P1 · **Persona:** Admin.

## Story
As an **admin**, I want to edit an existing loan's terms (where the web allows), so corrections don't require deleting and recreating.

## Verified facts
- **Endpoint exists:** `app/api/v1/loans/[id]/route.ts` exposes `GET` + **`PATCH`**. Open it and read the PATCH whitelist of editable fields — implement mobile edit for **exactly those fields**, nothing more (don't invent fields the API rejects).
- **Web reference:** `app/(dashboard)/[module]/loans/[id]/edit/page.tsx` + its client — shows which fields are editable and any post-edit recompute (schedule may regenerate server-side).
- **Mobile create form to clone:** `mobile/lib/features/loans/new_loan_screen.dart` (field set, validation, dropdowns).
- **Mobile loan model/service:** `mobile/lib/data/models/` loan model; `mobile/lib/data/services/` loan service. Add `update(id, patch)` mirroring `customer_service.update`.
- **Detail screen:** `mobile/lib/features/loans/loan_detail_screen.dart` — add an "Edit" action (admin-gated) that pushes the edit screen.

## Implementation
1. **Service:** add `Future<Loan> update(String id, Map<String,dynamic> patch)` → `PATCH Endpoints.loan(id)` (add `loan(id)` const if missing), unwrap to `Loan`.
2. **Screen:** reuse `new_loan_screen.dart` in an `editLoan` mode (constructor param `Loan? editLoan`), prefill controllers, validate, submit `patch` of only-changed whitelisted fields. After save: `ref.invalidate(loanDetailProvider(id))` + `loanListProvider`; snackbar; pop.
3. **Entry:** in `loan_detail_screen.dart`, AppBar action `Icons.edit` visible when `user?.role` ∈ {admin, superadmin, developer}.
4. **Recompute parity (🔢):** if web regenerates the schedule/restructure after edit, the **server PATCH must do it**; mobile only re-fetches `GET /loans/[id]` and shows API values. Never recompute in Dart.

## i18n
`loan.edit_title`="Edit Loan" · `loan.updated`="Loan updated" · reuse field labels from create.

## Acceptance criteria
- [ ] Only PATCH-whitelisted fields are sent.
- [ ] After edit, detail screen reflects API-recomputed schedule/rate (no Dart math).
- [ ] Edit action hidden for agents.
- [ ] `flutter analyze` clean.

## Files touched
- `mobile/lib/features/loans/new_loan_screen.dart` (edit mode) or new `edit_loan_screen.dart`.
- loan service + endpoints const.
- `mobile/lib/features/loans/loan_detail_screen.dart` (edit action).
- `app_strings.dart` (2 keys × 6 langs).
- *(only if PATCH lacks a needed field)* `app/api/v1/loans/[id]/route.ts`.
