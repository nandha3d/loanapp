import { parseFrequency, nextPeriodDate, periodWindow, frequencyLabel } from '../../lib/chits/frequency';

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${expected}, got ${actual}`);
  }
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ── Legacy preset regression — correct calendar semantics (fixes the
// month-overflow bug, does not reproduce it) ────────────────────────────────
const daily = parseFrequency({ auctionFrequency: 'daily' });
assertEqual(iso(nextPeriodDate(new Date('2026-01-01'), 1, daily)), '2026-01-01', 'daily period 1');
assertEqual(iso(nextPeriodDate(new Date('2026-01-01'), 5, daily)), '2026-01-05', 'daily period 5');

const weekly = parseFrequency({ auctionFrequency: 'weekly' });
assertEqual(iso(nextPeriodDate(new Date('2026-01-01'), 3, weekly)), '2026-01-15', 'weekly period 3');

const fortnightly = parseFrequency({ auctionFrequency: 'fortnightly' });
assertEqual(iso(nextPeriodDate(new Date('2026-01-01'), 3, fortnightly)), '2026-01-29', 'fortnightly period 3');

const monthly = parseFrequency({ auctionFrequency: 'monthly' });
assertEqual(iso(nextPeriodDate(new Date('2026-01-01'), 6, monthly)), '2026-06-01', 'monthly period 6 (no overflow risk)');

// ── addMonthsClamped: Jan 31 -> Feb (28/29) -> Mar 31 -> Apr 30 chain ───────
const start = new Date('2026-01-31');
assertEqual(iso(nextPeriodDate(start, 1, monthly)), '2026-01-31', 'month-overflow period 1 (start day)');
assertEqual(iso(nextPeriodDate(start, 2, monthly)), '2026-02-28', 'month-overflow period 2 clamps to Feb 28 (2026 not leap)');
assertEqual(iso(nextPeriodDate(start, 3, monthly)), '2026-03-31', 'month-overflow period 3 back to 31');
assertEqual(iso(nextPeriodDate(start, 4, monthly)), '2026-04-30', 'month-overflow period 4 clamps to Apr 30');

// Leap year: Jan 31 2028 + 1 month -> Feb 29 2028 (2028 is a leap year)
const leapStart = new Date('2028-01-31');
assertEqual(iso(nextPeriodDate(leapStart, 2, monthly)), '2028-02-29', 'leap year clamps to Feb 29');

// ── Custom every-N-unit ─────────────────────────────────────────────────────
const everyTenDays = { unit: 'day' as const, interval: 10 };
assertEqual(iso(nextPeriodDate(new Date('2026-01-01'), 4, everyTenDays)), '2026-01-31', 'every 10 days, period 4');

// ── Weekday-pick mode: Mon/Wed/Fri from a Monday start ──────────────────────
const monWedFri = { unit: 'week' as const, interval: 1, weekdays: [1, 3, 5] };
const mondayStart = new Date('2026-01-05'); // a Monday
assertEqual(iso(nextPeriodDate(mondayStart, 1, monWedFri)), '2026-01-05', 'Mon/Wed/Fri period 1 (Mon)');
assertEqual(iso(nextPeriodDate(mondayStart, 2, monWedFri)), '2026-01-07', 'Mon/Wed/Fri period 2 (Wed)');
assertEqual(iso(nextPeriodDate(mondayStart, 3, monWedFri)), '2026-01-09', 'Mon/Wed/Fri period 3 (Fri)');
assertEqual(iso(nextPeriodDate(mondayStart, 4, monWedFri)), '2026-01-12', 'Mon/Wed/Fri period 4 (next Mon)');
assertEqual(iso(nextPeriodDate(mondayStart, 5, monWedFri)), '2026-01-14', 'Mon/Wed/Fri period 5 (next Wed)');

// ── periodWindow ─────────────────────────────────────────────────────────────
const win = periodWindow(new Date('2026-01-01'), 2, monthly);
assertEqual(iso(win.from), '2026-02-01', 'periodWindow monthly from');
assertEqual(iso(win.to), '2026-03-01', 'periodWindow monthly to');

const dailyWin = periodWindow(new Date('2026-01-01'), 5, daily);
assertEqual(iso(dailyWin.from), '2026-01-05', 'periodWindow daily from');
assertEqual(iso(dailyWin.to), '2026-01-06', 'periodWindow daily to (one day span, not a month)');

// ── frequencyLabel ────────────────────────────────────────────────────────
assertEqual(frequencyLabel(monthly), 'Every month', 'label monthly');
assertEqual(frequencyLabel({ unit: 'week', interval: 2 }), 'Every 2 weeks', 'label every-2-weeks');
assertEqual(frequencyLabel(monWedFri), 'Mon/Wed/Fri', 'label weekday-pick');

// ── group.frequencyUnit overrides legacy auctionFrequency when set ─────────
const overridden = parseFrequency({ auctionFrequency: 'monthly', frequencyUnit: 'day', frequencyInterval: 3 });
assertEqual(overridden.unit, 'day', 'frequencyUnit overrides legacy preset');
assertEqual(overridden.interval, 3, 'frequencyInterval carried through');

console.log('chitFrequency tests passed');
