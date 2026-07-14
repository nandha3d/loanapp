# Step 16 — Custom Auction/Contribution Frequency Engine

> **Implementation status (2026-07-14): PARTIAL.** Daily/weekly/fortnightly/monthly already work but the date math is duplicated in two files with a real month-overflow bug. This doc consolidates into one engine and adds every-N-unit + weekday-pick customization.

## Goal

Requested: "daily, weekly, bi-weekly, monthly, and other frequency kinds — make an intelligent customization whatever kind of frequency." Concretely: presets for the common cases, plus a general `[every][N][unit]` custom option, plus (for daily/weekly chits) picking which weekdays count as a period.

## Current state (verified — duplication + bug)

Two independent implementations of the same date-stepping logic:

- `app/api/v1/chits/[id]/activate/route.ts:7-14`:
  ```ts
  function nextPeriodDate(startDate: Date, period: number, frequency: string) {
    const dueDate = new Date(startDate);
    if (frequency === 'daily') dueDate.setDate(dueDate.getDate() + period - 1);
    else if (frequency === 'weekly') dueDate.setDate(dueDate.getDate() + (period - 1) * 7);
    else if (frequency === 'fortnightly') dueDate.setDate(dueDate.getDate() + (period - 1) * 14);
    else dueDate.setMonth(dueDate.getMonth() + period - 1);
    return dueDate;
  }
  ```
- `app/(dashboard)/[module]/chits/actions.ts:67-72` — a second, near-identical copy.

**Bug**: the monthly branch (`dueDate.setMonth(dueDate.getMonth() + period - 1)`) does not clamp day-of-month. `Date.setMonth` overflows into the following month when the target month is shorter than the start day — e.g. a chit started 2026-01-31, period 3 → `setMonth` adds 2 → February has no 31st → JS rolls to **2026-03-03**, not the intended 2026-03-31 (or the conventionally-clamped 2026-02-28). Every chit whose `startDate` falls on the 29th/30th/31st silently drifts its schedule for any month with fewer days. This must be fixed as part of consolidation, not left as-is.

## Schema changes

```prisma
model ChitGroup {
  // ...existing fields...
  // auctionFrequency (existing: 'daily'|'weekly'|'fortnightly'|'monthly') is KEPT for back-compat / simple UI default.
  frequencyUnit     String  @default("month") @map("frequency_unit")     // 'day' | 'week' | 'month'
  frequencyInterval Int     @default(1)       @map("frequency_interval") // every N units
  frequencyWeekdays String? @map("frequency_weekdays")                    // CSV of 0-6 (Sun-Sat), only meaningful for unit='day'|'week'
}
```

Existing `auctionFrequency` presets map onto the new fields at read time (no backfill migration needed, just a mapping function — see below); new groups write both for compatibility with any code that still reads the old string field during the transition.

## Backend design

New dependency-free `lib/chits/frequency.ts` — **the single source of truth**, deleting both duplicated functions:

```ts
export type FrequencyConfig = { unit: 'day' | 'week' | 'month'; interval: number; weekdays?: number[] | null };

const LEGACY_PRESETS: Record<string, FrequencyConfig> = {
  daily: { unit: 'day', interval: 1 },
  weekly: { unit: 'week', interval: 1 },
  fortnightly: { unit: 'week', interval: 2 },
  monthly: { unit: 'month', interval: 1 },
};

export function parseFrequency(group: { auctionFrequency?: string | null;
  frequencyUnit?: string | null; frequencyInterval?: number | null; frequencyWeekdays?: string | null }): FrequencyConfig {
  if (group.frequencyUnit) {
    return { unit: group.frequencyUnit as any, interval: group.frequencyInterval || 1,
      weekdays: group.frequencyWeekdays ? group.frequencyWeekdays.split(',').map(Number) : null };
  }
  return LEGACY_PRESETS[group.auctionFrequency || 'monthly'] || LEGACY_PRESETS.monthly;
}

// Clamped month math: if start day > days-in-target-month, clamp to the last day of that
// month instead of letting setMonth overflow into the next month.
function addMonthsClamped(date: Date, months: number): Date {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  const candidate = new Date(d.getFullYear(), targetMonth, 1);
  const daysInTarget = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
  candidate.setDate(Math.min(d.getDate(), daysInTarget));
  return candidate;
}

export function nextPeriodDate(startDate: Date, period: number, freq: FrequencyConfig): Date {
  if (freq.weekdays?.length) {
    // Walk forward from startDate counting only matching weekdays until `period` occurrences reached.
    let count = 0, cursor = new Date(startDate);
    while (count < period) {
      if (freq.weekdays.includes(cursor.getDay())) count++;
      if (count < period) cursor.setDate(cursor.getDate() + 1);
    }
    return cursor;
  }
  const steps = (period - 1) * freq.interval;
  if (freq.unit === 'day') { const d = new Date(startDate); d.setDate(d.getDate() + steps); return d; }
  if (freq.unit === 'week') { const d = new Date(startDate); d.setDate(d.getDate() + steps * 7); return d; }
  return addMonthsClamped(startDate, steps); // unit === 'month'
}

export function frequencyLabel(freq: FrequencyConfig): string {
  // "Every day" | "Every 2 weeks" | "Every month" | "Every 3 months" | "Mon/Wed/Fri" etc, for UI preview + reports.
}

// Used by doc 22b ("current period" resolution) — the window a period's due date is
// considered "current" for, so a daily chit's "today" doesn't span a whole month.
export function periodWindow(startDate: Date, period: number, freq: FrequencyConfig): { from: Date; to: Date } {
  const from = nextPeriodDate(startDate, period, freq);
  const to = nextPeriodDate(startDate, period + 1, freq);
  return { from, to };
}
```

Update call sites:
- `app/api/v1/chits/[id]/activate/route.ts:7-14, 80, 95` — delete local `nextPeriodDate`, import from `lib/chits/frequency.ts`, call `parseFrequency(group)` once and pass the config through the period-generation loop.
- `app/(dashboard)/[module]/chits/actions.ts:67-72` — same deletion/replacement (this is presumably the web equivalent of group activation/schedule preview — locate and update both use sites).
- Any other place generating `ChitSubscription`/`ChitAuction` schedules (search for `auctionFrequency` usages beyond these two files before implementing, in case activation isn't the only schedule-generation path).

## Web UI

- Group create/edit form: replace the bare `auctionFrequency` `<select>` with a preset dropdown (Daily / Weekly / Bi-weekly / Monthly / Custom…) that maps to `{unit, interval}` under the hood; selecting "Custom…" reveals `[every][number input][unit select]` plus, when unit is day/week, a weekday-chip picker (Mon–Sun multi-select).
- Live preview: render the first 3 computed period dates below the picker using `nextPeriodDate`/`frequencyLabel` so admins can sanity-check before saving (calls a small server action or is computed client-side by porting the pure function — prefer a server action to keep the date logic server-only and avoid client/server drift).
- **Lock after activation**: once `group.status === 'active'` (subscriptions/auctions already generated per `activate/route.ts:70-101`), frequency fields become read-only in the edit form — changing the stepping after schedule generation would desync existing `ChitSubscription`/`ChitAuction` rows from the group config. Show an explanatory note rather than silently disabling.

## Mobile (Flutter)

No direct mobile UI for group creation (staff-only web feature per existing patterns) — mobile just displays whatever `frequencyLabel`/period dates the API returns, no client-side date math to add.

## Edge cases

- `startDate` on the 31st, monthly frequency, target month February → clamps to Feb 28 (or 29 in a leap year) via `addMonthsClamped`; document this clamping behaviour visibly in the UI preview so it isn't surprising.
- Weekday-pick with an empty/single-day selection — validate at least one weekday chosen when `unit` is day/week with weekdays set; if none selected, fall back to `interval`-based stepping (no weekday filter).
- `frequencyInterval <= 0` — reject in group validation (`validateChitConfig`, `lib/chits/validation.ts`), same pattern as existing percentage bound checks.
- Legacy groups (`frequencyUnit` null, only `auctionFrequency` set) must produce **byte-identical** `nextPeriodDate` output to the old functions for every already-generated period — this is the regression test below, and is why `parseFrequency` falls back through `LEGACY_PRESETS` rather than requiring backfill.

## Verification steps

- Regression test: for each legacy preset (daily/weekly/fortnightly/monthly) and periods 1–30, assert new `nextPeriodDate` output equals the **intended correct** date the old function should have produced (i.e. also fixes the month-overflow bug — write the test against correct calendar semantics, not against the buggy old output).
- Unit test `addMonthsClamped` specifically for Jan 31 → Feb (28/29) → Mar 31 → Apr 30 chains.
- Unit test weekday-pick mode: `weekdays=[1,3,5]` (Mon/Wed/Fri) from a Monday start produces periods 1,2,3,4,5 landing on the correct Mon/Wed/Fri/Mon/Wed sequence.
- Integration: activate a new group with a custom `every 10 days` frequency, assert generated `ChitSubscription.dueDate`/`ChitAuction.auctionDate` rows match `nextPeriodDate` exactly for all `totalMembers` periods.

## Dependencies

None blocking — pure function + two call-site swaps. This is a **prerequisite for doc 22b** (current-period resolution needs `periodWindow`) and should land in Phase 1 before any current-period UI work.
