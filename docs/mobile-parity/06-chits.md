# 06 · Chit Funds

## Web scope
- List groups; **create** group (`chits/new`); **edit** (`chits/[id]/edit`); detail (`chits/[id]`) with **auctions** and **members** management.

## Mobile current
- `chits/chits_screen.dart` (~721 lines) + `chitServiceProvider`.
- v1 endpoints exist: `GET /chits`, `GET /chits/[id]`, `GET /chits/[id]/auctions`, `GET /chits/[id]/members`.

## Gaps (verify against chits_screen.dart)
1. ❌/🟡 **Create** chit group (POST) — confirm presence.
2. ❌/🟡 **Edit** chit group (PATCH).
3. ❌/🟡 **Record auction** (POST `/chits/[id]/auctions`).
4. ❌/🟡 **Add/remove members** (POST/DELETE `/chits/[id]/members`).
5. 🟡 Member subscription collection flow.

## API needed
- `POST /api/v1/chits`, `PATCH /api/v1/chits/[id]`, `POST /api/v1/chits/[id]/auctions`, `POST/DELETE /api/v1/chits/[id]/members` (whichever are missing — currently only GETs are listed).

## Acceptance
- Mobile can create a group, add members, run an auction, matching web outcomes.

> **Needs line-by-line verification** of `chits_screen.dart` to mark which actions already exist.
