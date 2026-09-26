// Business-timezone day boundaries.
//
// The server runs in UTC but the business operates in India (IST, UTC+5:30,
// no DST). Computing "today" with the server's local (UTC) midnight makes the
// day flip 5.5h late, so between 00:00–05:30 IST the app still thinks it's
// "yesterday" — today's instalments look like future "upcoming" rows and the
// wrong day lands in the collection "Today" list.
//
// These helpers return the UTC instant of IST midnight, so date comparisons
// line up with the operator's calendar. Instalment dueDates stay stored as-is
// (UTC midnight); only the day-window math changes.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** UTC instant corresponding to 00:00 IST of the current IST day. */
export function startOfBusinessToday(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const utcMidnightOfIstDate = Date.UTC(
    ist.getUTCFullYear(),
    ist.getUTCMonth(),
    ist.getUTCDate(),
  );
  return new Date(utcMidnightOfIstDate - IST_OFFSET_MS);
}

/** UTC instant for 00:00 IST of the next IST day. */
export function startOfBusinessTomorrow(now: Date = new Date()): Date {
  const start = startOfBusinessToday(now);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/** UTC instant corresponding to 00:00 IST of an explicit YYYY-MM-DD date. */
export function startOfBusinessDate(day: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Invalid business date');
  const utc = Date.parse(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 10) !== day) {
    throw new Error('Invalid business date');
  }
  return new Date(utc - IST_OFFSET_MS);
}

/**
 * Date instance representing 00:00:00.000 UTC of the current calendar date in IST.
 * Intended for Prisma @db.Date columns (e.g. DailyCollection.date) where PostgreSQL
 * expects UTC midnight of that business calendar day.
 */
export function startOfBusinessDayUtc(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(ist.getUTCDate()).padStart(2, '0');
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
}

/**
 * Parses a date string (YYYY-MM-DD or ISO) into a UTC midnight Date aligned with business date.
 */
export function parseBusinessDayUtc(dateStr?: string | null, fallbackNow: Date = new Date()): Date {
  if (!dateStr) return startOfBusinessDayUtc(fallbackNow);
  const trimmed = dateStr.trim();
  const parts = trimmed.split('T')[0].split('-');
  if (parts.length === 3) {
    const yyyy = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10);
    const dd = parseInt(parts[2], 10);
    if (!isNaN(yyyy) && !isNaN(mm) && !isNaN(dd)) {
      return new Date(Date.UTC(yyyy, mm - 1, dd));
    }
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return startOfBusinessDayUtc(d);
  return startOfBusinessDayUtc(fallbackNow);
}

