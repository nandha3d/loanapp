/**
 * Daily-operations rules for the Auto Finance module: the collection agent's
 * allowed login window and the day-closing gate.
 *
 * Pure helpers — the callers (auth guard, dashboard, mobile API) supply the
 * stored values so these can be unit-tested without a database.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** The business calendar date (IST) as a `YYYY-MM-DD` string. */
export function businessDateKey(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return ist.toISOString().slice(0, 10);
}

/** UTC midnight of the given business date, matching how `@db.Date` stores it. */
export function businessDateValue(now: Date = new Date()): Date {
  return new Date(`${businessDateKey(now)}T00:00:00.000Z`);
}

export function previousBusinessDate(date: Date): Date {
  return new Date(date.getTime() - 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Login time window
// ---------------------------------------------------------------------------

/** Parses "HH:MM" into minutes past midnight, or null when unusable. */
export function parseTimeOfDay(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Minutes past IST midnight for the given instant. */
export function minutesIntoBusinessDay(now: Date = new Date()): number {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

export type LoginWindowResult = {
  allowed: boolean;
  /** Human-readable window, e.g. "08:00–20:00". Null when unrestricted. */
  window: string | null;
  message: string | null;
};

/**
 * Enforces a collection agent's allowed login window.
 *
 * Both ends unset (the default for every existing user) means no restriction.
 * A window whose end is before its start is treated as spanning midnight —
 * e.g. 22:00–06:00 for a night recovery shift.
 */
export function checkLoginWindow(
  user: { allowedLoginStart?: string | null; allowedLoginEnd?: string | null },
  now: Date = new Date(),
): LoginWindowResult {
  const start = parseTimeOfDay(user.allowedLoginStart);
  const end = parseTimeOfDay(user.allowedLoginEnd);

  // Unset, or only half-configured — fail open rather than lock people out.
  if (start === null || end === null) {
    return { allowed: true, window: null, message: null };
  }

  const window = `${user.allowedLoginStart}–${user.allowedLoginEnd}`;
  const nowMinutes = minutesIntoBusinessDay(now);
  const allowed = start <= end
    ? nowMinutes >= start && nowMinutes <= end
    : nowMinutes >= start || nowMinutes <= end; // spans midnight

  return {
    allowed,
    window,
    message: allowed ? null : `Login is only allowed between ${window}.`,
  };
}

// ---------------------------------------------------------------------------
// Day closing
// ---------------------------------------------------------------------------

export type DayClosingInput = {
  openingCash: number;
  collectedCash: number;
  disbursedCash: number;
  countedClosing: number;
};

export type DayClosingSummary = {
  openingCash: number;
  collectedCash: number;
  disbursedCash: number;
  expectedClosing: number;
  countedClosing: number;
  /** counted − expected. Negative means cash is short. */
  variance: number;
  balanced: boolean;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function summarizeDayClosing(input: DayClosingInput): DayClosingSummary {
  const openingCash = round2(Number(input.openingCash) || 0);
  const collectedCash = round2(Number(input.collectedCash) || 0);
  const disbursedCash = round2(Number(input.disbursedCash) || 0);
  const countedClosing = round2(Number(input.countedClosing) || 0);
  const expectedClosing = round2(openingCash + collectedCash - disbursedCash);
  const variance = round2(countedClosing - expectedClosing);

  return {
    openingCash,
    collectedCash,
    disbursedCash,
    expectedClosing,
    countedClosing,
    variance,
    // Sub-rupee drift from decimal rounding should not block a close.
    balanced: Math.abs(variance) < 1,
  };
}

export type DayClosingGate = {
  /** True when the operator must close a previous day before continuing. */
  blocked: boolean;
  /** The business date that still needs closing, as `YYYY-MM-DD`. */
  pendingDate: string | null;
  message: string | null;
};

/**
 * Staff cannot work the pending list until the previous business day has been
 * closed. `closedDates` is the set of `YYYY-MM-DD` keys already closed.
 *
 * `firstActivityDate` is the tenant's earliest operating day — days before it
 * never needed a close, so a brand-new workspace is not blocked on day one.
 */
export function evaluateDayClosingGate(
  closedDates: Iterable<string>,
  now: Date = new Date(),
  firstActivityDate?: string | null,
): DayClosingGate {
  const closed = new Set(closedDates);
  const yesterday = businessDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  if (firstActivityDate && yesterday < firstActivityDate) {
    return { blocked: false, pendingDate: null, message: null };
  }
  if (closed.has(yesterday)) {
    return { blocked: false, pendingDate: null, message: null };
  }

  return {
    blocked: true,
    pendingDate: yesterday,
    message: `Day closing for ${yesterday} is pending. Close it to continue.`,
  };
}
