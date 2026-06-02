# I2 — Chits: Create / Edit / Members / Auctions (mobile)

**Priority:** P2 · **Persona:** Admin.

## Story
As an **admin**, I want to create/edit chit groups, add members, and record auctions/bids on mobile.

## Verified facts
- Endpoints exist: `app/api/v1/chits/route.ts` (GET; check for POST), `chits/[id]/route.ts`, `chits/[id]/members/route.ts`, `chits/[id]/auctions/route.ts`. Open each to confirm which verbs (GET/POST/PATCH) are implemented; add missing verbs mirroring the web chit actions (`app/(dashboard)/[module]/chits/**/actions.ts` / `new`, `[id]/edit`).
- Mobile: `mobile/lib/features/chits/chits_screen.dart` (list/detail, read-mostly).
- i18n: `chits.*` keys exist (some added recently: editGroup, saveChanges, periodLabel, missedLabel, bidDiscount).

## Implementation
1. Confirm/extend endpoints: create group (POST `/chits`), edit (PATCH `/chits/[id]`), add member (POST `/chits/[id]/members`), record auction/bid (POST `/chits/[id]/auctions`). Copy computation (dividend, prize, bid discount) from web actions — **server-side only** (🔢).
2. Screens: `chit_new_screen.dart`, `chit_edit_screen.dart`, add-member sheet, auction sheet — clone field sets from web new/edit pages.
3. Service methods + models for members/auctions.
4. Wire from `chits_screen.dart` detail (admin-gated buttons).

## Acceptance criteria
- [ ] Create/edit group persists; detail reflects API values.
- [ ] Member add updates roster.
- [ ] Auction/bid recorded; dividend/prize from API.
- [ ] No chit math in Dart.

## Files touched
- `app/api/v1/chits/**` (add missing verbs).
- `mobile/lib/features/chits/**` (new screens), models, service.
- `app_strings.dart` (reuse `chits.*`).
