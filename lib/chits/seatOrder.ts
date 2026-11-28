/**
 * Round-robin customer interleaving for chit room seating and quick-select
 * strips so multi-ticket owners do not sit consecutively next to each other.
 */
export interface SeatOrderCandidate {
  customerId?: string | null;
  customer?: { id?: string | null; name?: string | null } | null;
  name?: string | null;
  ticketNo?: string | number | null;
  memberNumber?: number;
}

function customerBucketKey(item: SeatOrderCandidate): string {
  const cid = item.customerId || item.customer?.id;
  if (cid) return `id:${cid}`;
  const rawName = (item.name || item.customer?.name || '').trim().toLowerCase();
  if (rawName) return `name:${rawName}`;
  return `ticket:${String(item.ticketNo ?? item.memberNumber ?? Math.random())}`;
}

export function interleaveSeatsByCustomer<T extends SeatOrderCandidate>(seats: T[]): T[] {
  if (seats.length <= 2) return [...seats];

  const buckets = new Map<string, T[]>();
  for (const s of seats) {
    const key = customerBucketKey(s);
    const list = buckets.get(key) ?? [];
    list.push(s);
    buckets.set(key, list);
  }

  // Largest multi-ticket buckets first so their seats spread evenly around the table
  const sortedBuckets = Array.from(buckets.values()).sort((a, b) => b.length - a.length);
  const result: T[] = [];
  let remaining = seats.length;

  while (remaining > 0) {
    for (const bucket of sortedBuckets) {
      if (bucket.length > 0) {
        result.push(bucket.shift()!);
        remaining--;
      }
    }
  }

  // Final guard: if two identical customers still ended up adjacent (e.g. >50% tickets held by one person),
  // swap with the nearest non-matching seat when possible.
  for (let i = 1; i < result.length; i++) {
    if (customerBucketKey(result[i]) === customerBucketKey(result[i - 1])) {
      const k = customerBucketKey(result[i]);
      const swapIdx = result.findIndex(
        (cand, idx) =>
          idx !== i &&
          idx !== i - 1 &&
          customerBucketKey(cand) !== k &&
          (idx === 0 || customerBucketKey(result[idx - 1]) !== k) &&
          (idx === result.length - 1 || customerBucketKey(result[idx + 1]) !== k),
      );
      if (swapIdx !== -1) {
        const tmp = result[i];
        result[i] = result[swapIdx];
        result[swapIdx] = tmp;
      }
    }
  }

  return result;
}

export interface ConsolidatedSeatGroup<T extends SeatOrderCandidate> {
  primary: T;
  ticketCount: number;
  ticketNos: string[];
  tickets: T[];
}

/**
 * Collapses multiple tickets belonging to the same customer into one
 * representative seat (preferring the currently leading ticket, then the first
 * un-won ticket) so UIs in non-repeat-bid mode show one clear seat per member.
 */
export function consolidateSeatsByCustomer<T extends SeatOrderCandidate & { hasWon?: boolean }>(
  seats: T[],
  preferredTicketNo?: string | number | null,
): ConsolidatedSeatGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const s of seats) {
    const key = customerBucketKey(s);
    const list = buckets.get(key) ?? [];
    list.push(s);
    buckets.set(key, list);
  }

  const groups: ConsolidatedSeatGroup<T>[] = [];
  for (const tickets of buckets.values()) {
    const preferred =
      preferredTicketNo != null
        ? tickets.find((t) => String(t.ticketNo ?? t.memberNumber ?? '') === String(preferredTicketNo))
        : undefined;
    const primary = preferred ?? tickets.find((t) => !t.hasWon) ?? tickets[0];
    const ticketNos = tickets.map((t) => String(t.ticketNo ?? t.memberNumber ?? ''));
    groups.push({
      primary,
      ticketCount: tickets.length,
      ticketNos,
      tickets,
    });
  }

  return groups;
}

export const MAX_MAIN_TABLE_SEATS = 20;

/**
 * True Euclidean pixel-space stadium perimeter placement calibrated to the outer leather rail
 * of `/assets/poker_table.avif` (2712x1536 rendered at inset 3.5%). Computing lengths in pixel
 * space before normalizing guarantees equal visual spacing along straights AND semicircular caps
 * with a clean uniform breathing gap just outside the table rail.
 */
export function computeTableEdgeCoords(idx: number, total: number): { left: number; top: number } {
  if (total <= 1) return { left: 51.12, top: 16.9 };

  const W = 2712;
  const H = 1536;
  const cx = W * 0.5112;
  const cy = H * 0.502;

  const halfStraightPx = 562;
  const radiusPx = 512;

  const straightLen = halfStraightPx * 2;
  const arcLen = Math.PI * radiusPx;
  const totalPerimeter = 2 * straightLen + 2 * arcLen;

  const rawDist = ((idx / total) * totalPerimeter + straightLen / 2) % totalPerimeter;
  const leftJoinX = cx - halfStraightPx;
  const rightJoinX = cx + halfStraightPx;

  let x: number;
  let y: number;

  if (rawDist < straightLen) {
    x = leftJoinX + rawDist;
    y = cy - radiusPx;
  } else {
    const d1 = rawDist - straightLen;
    if (d1 < arcLen) {
      const theta = -Math.PI / 2 + (d1 / arcLen) * Math.PI;
      x = rightJoinX + radiusPx * Math.cos(theta);
      y = cy + radiusPx * Math.sin(theta);
    } else {
      const d2 = d1 - arcLen;
      if (d2 < straightLen) {
        x = rightJoinX - d2;
        y = cy + radiusPx;
      } else {
        const d3 = d2 - straightLen;
        const theta = Math.PI / 2 + (d3 / arcLen) * Math.PI;
        x = leftJoinX + radiusPx * Math.cos(theta);
        y = cy + radiusPx * Math.sin(theta);
      }
    }
  }

  return {
    left: Number(((x / W) * 100).toFixed(3)),
    top: Number(((y / H) * 100).toFixed(3)),
  };
}

export interface BenchCapCandidate extends SeatOrderCandidate {
  memberId?: string;
  isLeader?: boolean;
  latestPrize?: number | null;
}

/**
 * Keeps at most `maxTableSeats` (default 20) seats around the main table and
 * places any additional members in the right-hand bench panel. Any benched
 * member who places a valid bid is automatically promoted onto the main table
 * (replacing a non-bidding table seat from the tail).
 */
export function partitionTableAndBenchSeats<T extends BenchCapCandidate>(
  seats: T[],
  maxTableSeats = MAX_MAIN_TABLE_SEATS,
): { tableSeats: T[]; benchSeats: T[] } {
  const arranged = interleaveSeatsByCustomer(seats);
  if (arranged.length <= maxTableSeats) {
    return { tableSeats: arranged, benchSeats: [] };
  }

  const tableSeats = arranged.slice(0, maxTableSeats);
  const benchSeats = arranged.slice(maxTableSeats);

  // Promote any benched member who has placed a bid (or is currently leading) onto the table
  for (let bIdx = 0; bIdx < benchSeats.length; bIdx++) {
    const candidate = benchSeats[bIdx];
    const hasBid = candidate.latestPrize != null || Boolean(candidate.isLeader);
    if (!hasBid) continue;

    // Prefer replacing a table seat from the back that has not bid yet
    let replaceIdx = -1;
    for (let tIdx = tableSeats.length - 1; tIdx >= 0; tIdx--) {
      if (tableSeats[tIdx].latestPrize == null && !tableSeats[tIdx].isLeader) {
        replaceIdx = tIdx;
        break;
      }
    }
    // If all 20 table seats have bid, replace the worst (highest-prize) non-leader if bench bid is better
    if (replaceIdx === -1) {
      let worstPrize = -1;
      for (let tIdx = tableSeats.length - 1; tIdx >= 0; tIdx--) {
        const t = tableSeats[tIdx];
        if (t.isLeader) continue;
        const p = Number(t.latestPrize ?? 0);
        if (p > worstPrize) {
          worstPrize = p;
          replaceIdx = tIdx;
        }
      }
      if (
        replaceIdx !== -1 &&
        !candidate.isLeader &&
        candidate.latestPrize != null &&
        Number(candidate.latestPrize) >= worstPrize
      ) {
        replaceIdx = -1;
      }
    }

    if (replaceIdx !== -1) {
      const displaced = tableSeats[replaceIdx];
      tableSeats[replaceIdx] = candidate;
      benchSeats[bIdx] = displaced;
    }
  }

  return { tableSeats, benchSeats };
}
