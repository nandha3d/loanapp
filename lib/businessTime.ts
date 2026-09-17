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
