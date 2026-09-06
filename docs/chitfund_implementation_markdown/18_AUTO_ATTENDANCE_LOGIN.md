# Step 18 — Auto Attendance on Portal Login

> **Implementation status (2026-07-14): PARTIAL.** Room-join already marks attendance (`app/api/v1/borrower/chits/[id]/auctions/[auctionId]/join/route.ts`). This doc adds a second, independent trigger: any borrower-portal login on the day of a member's scheduled auction also marks attendance — per the user's locked-in decision ("any portal login on auction day").

## Goal

A member who logs into the borrower portal on the day their chit's auction is scheduled should be auto-marked present, even if they never open the live room (e.g. they check their dashboard, see the reminder, and plan to bid later, or they're just an infrequent-app-opener whose presence still matters for the physical/attendance record used in the minutes). This is **in addition to**, not a replacement for, the existing room-join marking.

## Current state (verified)

- `ChitAuctionAttendance` (`schema.prisma:1420-1441`) — `status` (present/proxy/absent), `admissionStatus` (waiting/admitted/denied/not_joined-by-default), unique on `(auctionId, memberId)`.
- Room-join route (`join/route.ts:37-50`) already upserts with `update: {}` — **critical existing pattern**: re-joining never overwrites a prior staff admit/deny decision. Login-based marking must follow the identical rule (never overwrite existing state).
- Staff manual marking (`markAuctionAttendance`, `actions.ts:574-599`) upserts with `update: { status, proxyName, markedById, markedAt }` — staff action **does** overwrite, which is correct (staff is the authority).
- Three cookie-setting branches in `app/api/borrower/auth/route.ts`: dev bypass (`~100-110`), OTP-setup-complete (`~214-224`), password login (`~262-272`) — all three set the `borrower_session` cookie and return success; this is where the hook fires.
- No existing concept of "present because logged in, but never joined the live room" — `admissionStatus` today only has waiting/admitted/denied and an implicit "not joined" absence of a row.

## Schema changes

```prisma
model ChitAuctionAttendance {
  // ...existing fields...
  markedVia String @default("staff") @map("marked_via") // 'staff' | 'room_join' | 'login' | 'whatsapp'
}
```

`admissionStatus` gains a new value `'none'` used **only** for login-triggered rows where the member has not joined the room — this is deliberately distinct from `'admitted'`: a login-only attendance mark must **never** bypass the waiting-room approval flow for `roomAdmission='approval'` groups. If the member later actually joins the room, the existing join route's `admissionStatus = approval-required ? 'waiting' : 'admitted'` logic upgrades the row normally (still via `update: {}`-style non-destructive semantics — only escalate `none` → `waiting`/`admitted`, never downgrade an existing `waiting`/`admitted`/`denied`).

## Backend design

New `lib/chits/attendanceAuto.ts`:

```ts
export async function markAttendanceOnLogin(customerId: string, tenantId: string) {
  // Tenant-local "today" window — a login at 11:58pm and an auction scheduled "today" in the
  // tenant's timezone must agree on what "today" means; do not use server-UTC midnight blindly.
  const { startOfDay, endOfDay } = tenantDayWindow(tenantId); // reuse existing tenant-TZ helper if one exists in lib/tenant.ts; else derive from AppSetting timezone key

  const memberships = await prisma.chitMember.findMany({
    where: { customerId, subscriberStatus: 'active', chitGroup: { tenantId, appType: 'chitfunds', deletedAt: null } },
    select: { id: true, chitGroupId: true, chitGroup: { select: { branchId: true } } },
  });
  if (!memberships.length) return;

  const todaysAuctions = await prisma.chitAuction.findMany({
    where: {
      chitGroupId: { in: memberships.map(m => m.chitGroupId) },
      status: { in: ['pending', 'notice_sent', 'in_progress'] },
      OR: [{ auctionDate: { gte: startOfDay, lte: endOfDay } }, { scheduledAt: { gte: startOfDay, lte: endOfDay } }],
    },
    select: { id: true, chitGroupId: true },
  });
  if (!todaysAuctions.length) return;

  const memberByGroup = new Map(memberships.map(m => [m.chitGroupId, m]));
  for (const auction of todaysAuctions) {
    const member = memberByGroup.get(auction.chitGroupId)!;
    await prisma.chitAuctionAttendance.upsert({
      where: { auctionId_memberId: { auctionId: auction.id, memberId: member.id } },
      create: { tenantId, branchId: member.chitGroup.branchId, auctionId: auction.id, memberId: member.id,
        status: 'present', admissionStatus: 'none', markedVia: 'login' },
      update: {}, // never overwrite an existing row — staff decisions and room-join state always win
    });
  }
}
```

Call **fire-and-forget** (don't block/slow the login response, don't fail login if this throws) after each of the three `borrower_session` cookie-set points in `app/api/borrower/auth/route.ts` (`~106`, `~220`, `~268`): `markAttendanceOnLogin(customer.id, customer.tenantId).catch(err => console.error(...))`. Also hook the equivalent mobile borrower-login path if one exists as a separate route from the web borrower auth (check `app/api/v1/borrower/auth` or similar mobile-context login endpoint — apply identically).

Update the **join route** (`join/route.ts:37-50`) to also set `markedVia: 'room_join'` on create, and the **staff manual route** (`actions.ts:586-598`) to set `markedVia: 'staff'` on both create and update — so all three sources are distinguishable in the UI/reports going forward (existing rows without a `markedVia` default to `'staff'` via the schema default, which is a reasonable backfill assumption since staff-marking was the only path before this feature).

## Web UI

- Staff attendance list (wherever `ChitAuctionAttendance` rows are displayed per auction — likely inside `AuctionDetailClient.tsx` or a group-detail tab): show a small chip per row — "via room" / "via login" / "via staff" / "via WhatsApp" (doc 23) — sourced from `markedVia`. Rows with `admissionStatus: 'none'` (logged in, never joined) should read distinctly from "admitted" (e.g. a muted "present (portal only)" badge) so staff aren't confused into thinking the member actually bid.

## Mobile (Flutter)

- No new UI required — this is a pure backend side-effect of login. If the Flutter borrower app calls a distinct mobile login endpoint (rather than the web route), the same `markAttendanceOnLogin` hook must be added there too — verify by locating the borrower/customer mobile auth route before implementing (do not assume the web route is the only entry point).

## Edge cases

- Member has multiple chit groups with auctions scheduled the same day — loop marks attendance for all of them (already handled by the `todaysAuctions` query spanning all memberships).
- Member logs in multiple times the same day — `update: {}` makes this idempotent, no duplicate rows (unique constraint on `(auctionId, memberId)` already enforces this).
- Member already marked `'admitted'` via room-join, then logs in again later the same day — login hook's `update: {}` leaves the row untouched; correct, room-join is stronger evidence than a login.
- Member already marked `'denied'` by staff (kicked from the room), then logs into the portal — login hook must **not** upgrade `denied` back to anything — `update: {}` already guarantees this by never touching existing rows, but call this out explicitly in code review since it's the one case where "auto-marking present" could look like it's overriding a staff moderation decision if implemented carelessly (e.g. do NOT special-case `denied` → `none`, just don't touch it at all).
- Auction with `status` already `confirmed`/`paid`/`cancelled` on login day (rare — same-day re-auction edge case) — excluded by the `status IN (pending, notice_sent, in_progress)` filter, matches the join route's own gating.

## Verification steps

- Unit test `markAttendanceOnLogin` with fixtures: member with 2 groups, one with a same-day auction, one without — assert only the relevant auction gets a row.
- Integration: login → assert `ChitAuctionAttendance{admissionStatus:'none', markedVia:'login'}` created; then call the join route → assert it upgrades to `waiting`/`admitted` per `roomAdmission`, not creating a duplicate row.
- Integration: staff denies a member, member logs in again → assert `admissionStatus` stays `'denied'`.
- Regression: existing `markAuctionAttendance` (staff) and `join` (room) flows unaffected — same upsert shape plus the new `markedVia` field only.

## Dependencies

None blocking. Independent of bells/timeline/frequency — can ship any time after Phase 2. Doc 23 (WhatsApp bids) will add a fourth `markedVia: 'whatsapp'` source using the same pattern.
