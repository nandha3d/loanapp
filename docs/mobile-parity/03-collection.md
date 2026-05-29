# 03 · Collection

## Web scope
- Unified grouped-by-customer list; filters: type (all/today/overdue), date, customer/loan search, route, **derived status** (Due Today/Overdue/Partial/Paid), frequency, overdue-day range.
- Pay modal: **oldest-first distribution across the loan's unpaid instalments** (clears overdue then today), payment mode, remarks, GPS stamp.
- Overdue customer popup (per-instalment list, pay each).
- Daily cash handover request; UPI/cash split; agent scope.
- Receipt PDF (if enabled).

## Mobile current
- `collection_screen.dart` + `quick_collect_sheet.dart`; `today()` endpoint; sync status screen.
- Pay via QuickCollectSheet → `POST /api/v1/collection/entry`.

## Gaps (verify against `collection_screen.dart` line-by-line)
1. 🔢 **Oldest-first distribution** — confirm the mobile pay path hits the same `submitCollectionEntry` logic. The web action distributes across instalments; the v1 `collection/entry` route must do the **same**. **If v1 caps to one instalment, fix it in the v1 route** (mobile-only).
2. 🟡 Filters: ensure mobile has type/route/status/date/overdue-range parity.
3. 🟡 Derived status labels ("Due Today" vs raw "upcoming") — apply the same derivation on mobile.
4. 🟡 Cash handover + UPI/cash split summary.
5. 🟡 Receipt download.

## API needed
- Confirm/990 `POST /api/v1/collection/entry` distributes oldest-first (parity with web `submitCollectionEntry`). **Action:** read `app/api/v1/collection/entry/route.ts` and align.
- `GET /api/v1/collection/today` should return enough to derive status (dueDate, received, daysOverdue).

## Acceptance
- Paying ₹X on mobile allocates identically to web (overdue first, then today).
- Status chips read Due Today/Overdue/Partial/Paid, never raw "upcoming".
