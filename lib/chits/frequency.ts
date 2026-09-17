// Single source of truth for chit period date-stepping. Replaces two
// byte-identical duplicated `nextPeriodDate` functions (app/api/v1/chits/[id]
// /activate/route.ts and app/(dashboard)/[module]/chits/actions.ts) which both
// had the same month-overflow bug: `Date.setMonth` doesn't clamp day-of-month,
// so a chit started on the 31st drifts into the following month for any
// shorter target month (Jan 31 + 1 month -> Mar 3, not Feb 28).

export type FrequencyConfig = {
  unit: 'day' | 'week' | 'month';
  interval: number;
  weekdays?: number[] | null;
};

const LEGACY_PRESETS: Record<string, FrequencyConfig> = {
  daily: { unit: 'day', interval: 1 },
  weekly: { unit: 'week', interval: 1 },
  fortnightly: { unit: 'week', interval: 2 },
  monthly: { unit: 'month', interval: 1 },
};

export function parseFrequency(group: {
  auctionFrequency?: string | null;
  frequencyUnit?: string | null;
  frequencyInterval?: number | null;
  frequencyWeekdays?: string | null;
}): FrequencyConfig {
  if (group.frequencyUnit) {
    return {
      unit: group.frequencyUnit as FrequencyConfig['unit'],
      interval: group.frequencyInterval || 1,
      weekdays: group.frequencyWeekdays
        ? group.frequencyWeekdays.split(',').map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
        : null,
    };
  }
  return LEGACY_PRESETS[group.auctionFrequency || 'monthly'] || LEGACY_PRESETS.monthly;
}

// Clamped month math: if the start day exceeds the number of days in the
// target month, clamp to the last day of that month instead of letting
// `setMonth` overflow into the next month.
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
    // Walk forward from startDate counting only matching weekdays until
    // `period` occurrences are reached (period 1 = the first matching day
    // on/after startDate).
    let count = 0;
    const cursor = new Date(startDate);
    while (count < period) {
      if (freq.weekdays.includes(cursor.getDay())) count++;
      if (count < period) cursor.setDate(cursor.getDate() + 1);
    }
    return cursor;
  }
  const steps = (period - 1) * freq.interval;
  if (freq.unit === 'day') {
    const d = new Date(startDate);
    d.setDate(d.getDate() + steps);
    return d;
  }
  if (freq.unit === 'week') {
    const d = new Date(startDate);
    d.setDate(d.getDate() + steps * 7);
    return d;
  }
  return addMonthsClamped(startDate, steps); // unit === 'month'
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function frequencyLabel(freq: FrequencyConfig): string {
  if (freq.weekdays?.length) {
    return freq.weekdays
      .slice()
      .sort((a, b) => a - b)
      .map((d) => WEEKDAY_NAMES[d])
      .join('/');
  }
  const unitLabel = freq.unit === 'day' ? 'day' : freq.unit === 'week' ? 'week' : 'month';
  if (freq.interval === 1) return `Every ${unitLabel}`;
  return `Every ${freq.interval} ${unitLabel}s`;
}

// The window a given period's due date is considered "current" for — a daily
// chit's "today" is one day, a monthly chit's is roughly a month. Used by
// doc 22b's current-period-first borrower views.
export function periodWindow(startDate: Date, period: number, freq: FrequencyConfig): { from: Date; to: Date } {
  const from = nextPeriodDate(startDate, period, freq);
  const to = nextPeriodDate(startDate, period + 1, freq);
  return { from, to };
}
