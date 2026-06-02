# G2 — Approvals: full request-type coverage (mobile)

**Priority:** P1 · **Persona:** Admin.

## Story
As an **admin**, I want to approve/reject **every** request type the web supports (customer edit, penalty waive, loan changes, payment proofs, branch/module requests as applicable), each with a note.

## Verified facts
- **Endpoints exist:** `app/api/v1/approvals/route.ts` (GET queue), `app/api/v1/approvals/[id]/approve/route.ts`, `app/api/v1/approvals/[id]/reject/route.ts`.
- **Gap is coverage, not plumbing.** Read `app/api/v1/approvals/route.ts` GET to see which `entityType`s it returns vs the web queue (`app/(dashboard)/[module]/approvals/page.tsx`). If the v1 GET filters to a subset, broaden it to match web (server change, additive). 
- **Mobile screen:** `mobile/lib/features/approvals/approvals_screen.dart` (already approve/reject).

## Implementation
1. **Align queue:** ensure `GET /api/v1/approvals` returns the same request types as web (same `where`/`entityType in [...]`). Add missing types.
2. **Render per-type detail:** the mobile card must show type-specific payload (e.g. customer-edit shows old→new; penalty-waive shows amount+reason; loan change shows fields). Parse `request.payload`/`oldValue`/`newValue` JSON generically and render key→value rows.
3. **Approve/Reject with note:** dialog with optional note → POST approve/reject (note in body). Server already applies the side-effect on approve (verify each type's apply path exists; if a type's apply is web-only, port it into the approve route).
4. Invalidate queue after action.

## i18n
`appr.note`="Review note" · `appr.approved`="Approved" · `appr.rejected`="Rejected" · per-type titles as needed.

## Acceptance criteria
- [ ] Mobile queue == web queue (same types, same count).
- [ ] Each type renders meaningful detail.
- [ ] Approve applies the correct side-effect (verified per type).
- [ ] Note persisted on the approval record.

## Files touched
- `mobile/lib/features/approvals/approvals_screen.dart`.
- *(if coverage gaps)* `app/api/v1/approvals/route.ts`, `.../[id]/approve/route.ts`, `.../[id]/reject/route.ts`.
- `app_strings.dart`.
