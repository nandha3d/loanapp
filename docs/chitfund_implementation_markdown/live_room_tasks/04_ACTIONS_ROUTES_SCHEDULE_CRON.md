# Task 04 — Scheduling, Reschedule & Reminder Cron (Milestone 1)

**Owner:** 1 agent. **Depends on:** 01 (schema), 02 (validateChitConfig extension — coordinate; if 02 not merged, add the `auctionTime` regex check yourself and let 02 reconcile). **Parallel with:** 03.
**Read** `00_OVERVIEW_AND_DEPENDENCIES.md` first.

## Goal

1. Capture an **auction time** on group create and stamp each generated auction's `scheduledAt` on activation.
2. Let organizers **reschedule** an auction (date + time), web action + mobile route.
3. A **reminder cron** that sends 1-day and 1-hour-before notices to members (WhatsApp/SMS) and staff (FCM), idempotently.

## 1. Capture `auctionTime` on create

File `app/(dashboard)/[module]/chits/actions.ts`, `createChitGroup`. It already reads many `value(formData, ...)` fields into the `tx.chitGroup.create({ data: {...} })`. Add:
```ts
auctionTime: value(formData, 'auctionTime'),               // "HH:mm" or null
winnerInterestType: value(formData, 'winnerInterestType') ?? 'NONE',
winnerInterestValue: numberValue(formData, 'winnerInterestValue'),
winnerInterestPeriods: numberValue(formData, 'winnerInterestPeriods'),
```
And pass the new fields into the existing `validateChitConfig({ ... })` call (task 02 extends that validator; include `auctionTime`, `winnerInterestType`, `winnerInterestValue`, `winnerInterestPeriods`).

## 2. Stamp `scheduledAt` on activation

Same file, `activateChitGroup`. Where it generates auction stubs (`tx.chitAuction.create({ data: { chitGroupId, periodNumber, auctionDate, scheduledAt, status:'pending' } })`), set `scheduledAt` from the group's date + time:

```ts
function combineDateTime(date: Date, hhmm: string | null): Date {
  const d = new Date(date);
  const [h, m] = (hhmm ?? '10:00').split(':').map(Number);
  d.setHours(Number.isFinite(h) ? h : 10, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}
// per period:
const auctionDate = nextPeriodDate(group.startDate, period, group.auctionFrequency);
const scheduledAt = combineDateTime(auctionDate, group.auctionTime);
// ...create({ data: { ..., auctionDate, scheduledAt } })
```
`nextPeriodDate` already exists in the file. Fallback time `10:00` when `auctionTime` is null.

## 3. Reschedule — web action + mobile route

### Web server action (in `actions.ts`)
```ts
export async function rescheduleAuction(auctionId: string, newDateTimeISO: string) {
  const scope = await getWebChitScope();
  assertChitRole(scope.role, ['admin', 'superadmin', 'developer']);
  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope) },
  });
  if (!auction) throw new Error('Auction not found');
  if (!['pending', 'notice_sent'].includes(auction.status)) {
    throw new Error('Only a not-yet-started auction can be rescheduled');
  }
  const when = new Date(newDateTimeISO);
  if (Number.isNaN(when.getTime())) throw new Error('Invalid date/time');
  await prisma.$transaction(async (tx) => {
    await tx.chitAuction.update({
      where: { id: auction.id },
      // reset reminder stamps so the new schedule re-triggers reminders
      data: { auctionDate: when, scheduledAt: when, reminder1DayAt: null, reminder1HourAt: null },
    });
    await createChitAudit(tx, {
      tenantId: scope.tenantId, userId: scope.userId, action: 'reschedule',
      entityType: 'chit_auction', entityId: auction.id, newValue: { scheduledAt: when.toISOString() },
    });
  });
  revalidatePath(modulePath(scope.appType, `/chits/${auction.chitGroupId}`));
}
```

### Mobile route
Create `app/api/v1/chits/[id]/auctions/[auctionId]/schedule/route.ts` (here `[auctionId]` is a **real cuid** — this sits beside `bids/confirm/draw`, not the period-number routes). `PATCH` (or POST), body `{ scheduledAt: ISOString }`, `requireMobileContext`, role in `LIVE_WRITE_ROLES`, same status guard + stamp reset, return `ok(updated)`. Add `Endpoints.chitAuctionSchedule` to `mobile/lib/shared/constants/endpoints.dart` and a `ChitService.reschedule(groupId, auctionId, when)` method (task 06 will wire the button; you just provide the endpoint + service method).

## 4. Reminder cron

Create `app/api/cron/chit-auction-reminders/route.ts`. Copy the auth + throttle shape of `app/api/cron/send-reminders/route.ts`.

```ts
import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { notify } from '@/lib/notify/events';   // confirm export name/signature in lib/notify/events.ts

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const now = Date.now();
  let sent = 0;

  // 1-day bucket: scheduled in ~24h (23–25h) and not yet day-reminded.
  const dayWindowLo = new Date(now + 23 * 60 * 60 * 1000);
  const dayWindowHi = new Date(now + 25 * 60 * 60 * 1000);
  const dayAuctions = await prisma.chitAuction.findMany({
    where: {
      status: { in: ['pending', 'notice_sent'] },
      scheduledAt: { gte: dayWindowLo, lte: dayWindowHi },
      reminder1DayAt: null,
    },
    include: { chitGroup: { include: { members: { include: { customer: true } } } } },
  });
  for (const a of dayAuctions) {
    await sendAuctionReminder(a, 'day');
    await prisma.chitAuction.update({ where: { id: a.id }, data: { reminder1DayAt: new Date() } });
    sent++;
  }

  // 1-hour bucket: scheduled in ~1h (45–75m) and not yet hour-reminded.
  const hourWindowLo = new Date(now + 45 * 60 * 1000);
  const hourWindowHi = new Date(now + 75 * 60 * 1000);
  const hourAuctions = await prisma.chitAuction.findMany({
    where: {
      status: { in: ['pending', 'notice_sent'] },
      scheduledAt: { gte: hourWindowLo, lte: hourWindowHi },
      reminder1HourAt: null,
    },
    include: { chitGroup: { include: { members: { include: { customer: true } } } } },
  });
  for (const a of hourAuctions) {
    await sendAuctionReminder(a, 'hour');
    await prisma.chitAuction.update({ where: { id: a.id }, data: { reminder1HourAt: new Date() } });
    sent++;
  }

  return Response.json({ ok: true, sent, day: dayAuctions.length, hour: hourAuctions.length });
}
```

`sendAuctionReminder(auction, kind)`: for each **active** member (`subscriberStatus === 'active'`) with a customer phone, call `notify()` with template key `chit_auction_reminder_day` / `chit_auction_reminder_hour` and vars `{ groupName, periodNumber, scheduledAt (formatted local), chitValue }`. Throttle ~100ms between sends (copy send-reminders). Wrap each send in try/catch so one failure doesn't abort the batch. **Inspect `lib/notify/events.ts` for the real `notify()` signature** (tenantId, customerId/recipient, templateKey, vars, channel preference) and match it — do not invent params. Staff FCM is optional; if `lib/notify/channels/push.ts` has a simple send-to-user helper, notify the group's operator/branch admins too, else skip and note it.

### Notification templates
Add rows/keys `chit_auction_reminder_day` and `chit_auction_reminder_hour` wherever templates are registered (`NotificationTemplate` seed or the template map used by `notify()` — grep for an existing key like `payment_reminder` to find the registry). Provide EN text at minimum: `"Chit auction for {groupName} (period {periodNumber}) is scheduled at {scheduledAt}. Please join the live room."` Keep it template-driven so multi-lang works.

### VPS trigger (documentation, not code)
Append to `docs/chitfund_implementation_markdown/12_LIVE_AUCTION_ROOM_POLLING.md` a "Deploy — reminders" note:
```
# On the PM2 VPS, Vercel crons do not run. Add an OS crontab entry:
*/15 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/chit-auction-reminders >/dev/null 2>&1
```
Every 15 min is safe: the 23–25h and 45–75m windows are wide enough that a 15-min tick always catches each auction once, and the `reminder*At` stamps guarantee exactly-once.

## Acceptance criteria

- Create group with `auctionTime` → activation stamps every auction `scheduledAt` at that time (10:00 fallback).
- `rescheduleAuction` (web) + `schedule` route (mobile) update date+time, reset reminder stamps, block once the auction has started, and audit.
- `GET /api/cron/chit-auction-reminders` with the correct bearer returns `{sent}`; auctions in-window get reminded exactly once (stamp flips); wrong/no bearer → 401.
- `npm run typecheck` passes.

## Commit

```
feat(chit): auction scheduling, reschedule, and reminder cron

Capture auctionTime on create, stamp scheduledAt on activation, add
rescheduleAuction (web) + schedule route (mobile) with reminder-stamp reset,
and a CRON_SECRET-guarded reminder route that sends 1-day/1-hour notices
idempotently via reminder1DayAt/1HourAt stamps. VPS crontab documented.
```
