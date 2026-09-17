import assert from 'node:assert/strict';

// Test 1: Paid Period calculation logic matching LoanDetailClient.tsx
function computePaidPeriod(totalInstalments: number, outstanding: number, isClosed: boolean, instalments: Array<{ instalmentNo: number; status: string }>) {
  const dynamicRemainingCount = (outstanding <= 0 || isClosed)
    ? 0
    : Math.ceil(outstanding / 1000);

  const waivedInstalments = instalments.filter((i) => i.status === 'waived');

  if (waivedInstalments.length > 0) {
    const firstWaivedNo = Math.min(...waivedInstalments.map((i) => Number(i.instalmentNo)));
    if (Number.isFinite(firstWaivedNo) && firstWaivedNo > 1) {
      return firstWaivedNo - 1;
    }
    return Math.max(0, totalInstalments - waivedInstalments.length);
  }

  if (outstanding <= 0 || isClosed) {
    return totalInstalments;
  }

  return Math.max(0, totalInstalments - dynamicRemainingCount);
}

// Test 2: Closure instalment selection logic matching lib/loanPreclose.ts
function pickClosureInstalment(allInstalments: Array<{ id: string; instalmentNo: number; dueDate: string; status: string }>, todayStart: Date) {
  const todayInst = allInstalments.find((i) => {
    const d = new Date(i.dueDate);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === todayStart.getTime();
  });

  if (todayInst) {
    return todayInst;
  }

  const lastInst = allInstalments[allInstalments.length - 1];
  const firstInst = allInstalments[0];
  if (todayStart.getTime() >= new Date(lastInst.dueDate).getTime()) {
    return lastInst;
  } else if (todayStart.getTime() <= new Date(firstInst.dueDate).getTime()) {
    return firstInst;
  } else {
    const pastOrCurrent = allInstalments.filter((i) => new Date(i.dueDate) <= todayStart);
    return pastOrCurrent[pastOrCurrent.length - 1] || allInstalments[0];
  }
}

// 1. Verify closure instalment selection does NOT jump to tomorrow when today's row is already paid
const today = new Date('2026-09-16T00:00:00.000Z');
const mockSchedule = Array.from({ length: 100 }, (_, idx) => {
  const no = idx + 1;
  const d = new Date('2026-06-22T00:00:00.000Z');
  d.setDate(d.getDate() + idx);
  return {
    id: `inst-${no}`,
    instalmentNo: no,
    dueDate: d.toISOString(),
    status: no <= 87 ? 'paid' : 'upcoming', // row 87 (16 Sept 2026) is already paid
  };
});

const closureInst = pickClosureInstalment(mockSchedule, today);
assert.equal(closureInst.instalmentNo, 87, 'Must pick row 87 (today), NOT jump to row 88 (tomorrow)');
assert.equal(closureInst.dueDate.slice(0, 10), '2026-09-16', 'DueDate of closure instalment must be today');

// 2. Verify subsequent instalments are waived
const futureInsts = mockSchedule.filter((i) => i.instalmentNo > closureInst.instalmentNo);
assert.equal(futureInsts.length, 13, 'Must have exactly 13 future instalments (88-100)');
futureInsts.forEach((i) => (i.status = 'waived'));

// 3. Verify paid period is correctly 87 Days, NOT 100 Days
const paidPeriod = computePaidPeriod(100, 0, true, mockSchedule);
assert.equal(paidPeriod, 87, 'Paid period must be 87 Days for preclosure on day 87');

// 4. Verify a non-waived normal completion displays full 100 Days
const normalSchedule = Array.from({ length: 100 }, (_, idx) => ({
  instalmentNo: idx + 1,
  status: 'paid',
}));
const normalPaidPeriod = computePaidPeriod(100, 0, true, normalSchedule);
assert.equal(normalPaidPeriod, 100, 'Normal 100-day loan completion must display 100 Days');

// 5. Verify mid-term preclosure on day 50 displays 50 Days
const midSchedule = Array.from({ length: 100 }, (_, idx) => ({
  instalmentNo: idx + 1,
  status: idx + 1 <= 50 ? 'paid' : 'waived',
}));
const midPaidPeriod = computePaidPeriod(100, 0, true, midSchedule);
assert.equal(midPaidPeriod, 50, 'Day 50 preclosure must display 50 Days');

console.log('Preclosure date anchoring and paid period calculation tests passed');
