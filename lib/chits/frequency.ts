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
  DAILY_30: { unit: 'day', interval: 1 },
  DAILY_25: { unit: 'day', interval: 1, weekdays: [1, 2, 3, 4, 5, 6] },
  weekly: { unit: 'week', interval: 1 },
  WEEKLY: { unit: 'week', interval: 1 },
  fortnightly: { unit: 'week', interval: 2 },
  FORTNIGHTLY: { unit: 'week', interval: 2 },
  monthly: { unit: 'month', interval: 1 },
  MONTHLY: { unit: 'month', interval: 1 },
  BI_MONTHLY: { unit: 'month', interval: 2 },
  SEASONAL_HARVEST: { unit: 'month', interval: 3 },
};

export function collectionFrequencyToConfig(freq: string | null | undefined): FrequencyConfig {
  if (!freq) return LEGACY_PRESETS.monthly;
  return LEGACY_PRESETS[freq] || LEGACY_PRESETS.monthly;
}

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

// Clamped month math in UTC (DATE-1): if the start day exceeds the number of
// days in the target month, clamp to the last day of that month instead of
// letting `setUTCMonth` overflow, avoiding local-timezone DST/offset day drift.
function addMonthsClamped(date: Date, months: number): Date {
  const d = new Date(date);
  const targetYear = d.getUTCFullYear();
  const targetMonth = d.getUTCMonth() + months;
  const firstOfTarget = new Date(Date.UTC(targetYear, targetMonth, 1));
  const daysInTarget = new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      firstOfTarget.getUTCFullYear(),
      firstOfTarget.getUTCMonth(),
      Math.min(d.getUTCDate(), daysInTarget),
    ),
  );
}

export function nextPeriodDate(startDate: Date, period: number, freq: FrequencyConfig): Date {
  if (freq.weekdays?.length) {
    // Walk forward from startDate counting only matching weekdays until
    // `period` occurrences are reached (period 1 = the first matching day
    // on/after startDate).
    let count = 0;
    const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    while (count < period) {
      if (freq.weekdays.includes(cursor.getUTCDay())) count++;
      if (count < period) cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return cursor;
  }
  const steps = (period - 1) * freq.interval;
  if (freq.unit === 'day') {
    const d = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + steps);
    return d;
  }
  if (freq.unit === 'week') {
    const d = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + steps * 7);
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
