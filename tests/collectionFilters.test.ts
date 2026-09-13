import assert from 'node:assert';
import test from 'node:test';

// Test suite for Desktop Collection Entry Filter Logic
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getIstDateStr(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const day = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getLocalDateStr(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getIstCalendarDayNumber(dateInput: Date | string): number {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return Math.floor(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) / 86400000);
}

function enrichInstalment(instalment: any, today: Date) {
  const dueAmount = Number(instalment.dueAmount);
  const receivedAmount = Number(instalment.receivedAmount || 0);
  const outstandingAmount = Math.max(0, dueAmount - receivedAmount);
  const dueDate = new Date(instalment.dueDate);
  const todayDayNum = getIstCalendarDayNumber(today);
  const dueDayNum = getIstCalendarDayNumber(dueDate);
  const daysOverdue = Math.max(0, todayDayNum - dueDayNum);
  const isOverdue = dueDayNum < todayDayNum;

  return {
    ...instalment,
    dueAmount,
    receivedAmount,
    outstandingAmount,
    overdueAmount: isOverdue ? outstandingAmount : 0,
    daysOverdue,
  };
}

function deriveInstalmentStatus(
  inst: { dueDate: string; receivedAmount: number; outstandingAmount: number; daysOverdue: number },
  todayStr: string,
): { key: string; label: string } {
  if (inst.outstandingAmount <= 0 && inst.receivedAmount > 0) return { key: 'paid', label: 'Paid' };
  if (inst.receivedAmount > 0 && inst.daysOverdue === 0) return { key: 'partial', label: 'Partial' };
  if (inst.daysOverdue > 0) return { key: 'missed', label: 'Missed' };
  const dueIst = getIstDateStr(inst.dueDate);
  if (dueIst > todayStr) return { key: 'upcoming', label: 'Upcoming' };
  return { key: 'due today', label: 'Due Today' };
}

function filterRows(allInstalments: any[], filters: any, todayISO: string) {
  const {
    typeFilter = 'all',
    dateFilter = '',
    customerFilter = '',
    routeFilter = '',
    statusFilter = '',
    frequencyFilter = '',
    sessionFilter = '',
    overdueMinDays = '',
    overdueMaxDays = '',
  } = filters;

  return allInstalments.filter((row) => {
    const isOverdueTargeted = statusFilter === 'missed' || (overdueMinDays !== '' && Number(overdueMinDays) > 0);
    const isTodayTargeted = statusFilter === 'due today';
    const isDateSpecific = Boolean(dateFilter && dateFilter !== todayISO);

    if (typeFilter === 'today' && !isOverdueTargeted && !isDateSpecific && row.source !== 'today') return false;
    if (typeFilter === 'overdue' && !isTodayTargeted && !isDateSpecific && row.source !== 'overdue') return false;

    const istDate = getIstDateStr(row.dueDate);
    const localDate = getLocalDateStr(row.dueDate);
    const utcDate = new Date(row.dueDate).toISOString().slice(0, 10);
    const rawDate = typeof row.dueDate === 'string' ? row.dueDate.slice(0, 10) : '';
    const matchesDate = !dateFilter || istDate === dateFilter || localDate === dateFilter || utcDate === dateFilter || rawDate === dateFilter;

    const search = customerFilter.trim().toLowerCase();
    const custName = (row.loan?.customer?.name || '').toLowerCase();
    const custCode = (row.loan?.customer?.customerCode || '').toLowerCase();
    const custPhone = (row.loan?.customer?.phone || '').toLowerCase();
    const loanCode = (row.loan?.loanCode || '').toLowerCase();
    const routeName = (row.loan?.customer?.route?.name || '').toLowerCase();
    const matchesCustomer = !search
      || custName.includes(search)
      || custCode.includes(search)
      || custPhone.includes(search)
      || loanCode.includes(search)
      || routeName.includes(search);

    const custRouteId = row.loan?.customer?.route?.id || (row.loan?.customer as any)?.routeId;
    const matchesRoute = !routeFilter || custRouteId === routeFilter || row.loan?.customer?.route?.name === routeFilter;

    const statusInfo = deriveInstalmentStatus(row, todayISO);
    let matchesStatus = true;
    if (statusFilter) {
      if (statusFilter === 'missed') {
        matchesStatus = statusInfo.key === 'missed' || (row.daysOverdue > 0 && row.outstandingAmount > 0) || (row.source === 'overdue' && row.outstandingAmount > 0);
      } else if (statusFilter === 'due today') {
        matchesStatus = statusInfo.key === 'due today' || (row.source === 'today' && row.daysOverdue === 0 && row.outstandingAmount > 0);
      } else if (statusFilter === 'partial') {
        matchesStatus = statusInfo.key === 'partial' || (row.receivedAmount > 0 && row.outstandingAmount > 0);
      } else if (statusFilter === 'paid') {
        matchesStatus = statusInfo.key === 'paid' || (row.outstandingAmount <= 0 && row.receivedAmount > 0) || row.status === 'paid';
      } else if (statusFilter === 'upcoming') {
        matchesStatus = statusInfo.key === 'upcoming' || istDate > todayISO;
      } else {
        matchesStatus = statusInfo.key === statusFilter;
      }
    }

    const matchesFrequency = !frequencyFilter || (row.loan?.frequency || '').toLowerCase() === frequencyFilter.toLowerCase();

    const preferredSession = (row.loan?.customer?.preferredCollectionTime || '').toLowerCase().trim();
    const knownSessions = ['morning', 'afternoon', 'evening', 'night'];
    const matchesSession = !sessionFilter
      || (sessionFilter === 'anytime' && (!preferredSession || preferredSession === 'anytime'))
      || (sessionFilter === 'other' && !!preferredSession && !knownSessions.includes(preferredSession) && preferredSession !== 'anytime')
      || preferredSession === sessionFilter;

    const minD = overdueMinDays !== '' && !isNaN(Number(overdueMinDays)) ? Number(overdueMinDays) : 0;
    const maxD = overdueMaxDays !== '' && !isNaN(Number(overdueMaxDays)) ? Number(overdueMaxDays) : Infinity;
    const matchesOverdueDays = row.daysOverdue >= minD && row.daysOverdue <= maxD;

    return matchesDate && matchesCustomer && matchesRoute && matchesStatus && matchesFrequency && matchesSession && matchesOverdueDays;
  });
}

// ── Tests ─────────────────────────────────────────────────────────────

test('1. enrichInstalment calculates daysOverdue accurately across IST day boundary', () => {
  // Today: 2026-09-13 00:00:00 IST (2026-09-12T18:30:00.000Z)
  const today = new Date('2026-09-12T18:30:00.000Z');

  // Due yesterday (2026-09-12)
  const instYesterday = {
    id: 'inst-1',
    dueAmount: 500,
    receivedAmount: 0,
    dueDate: '2026-09-12T00:00:00.000Z',
  };
  const enrichedYesterday = enrichInstalment(instYesterday, today);
  assert.strictEqual(enrichedYesterday.daysOverdue, 1, 'Yesterday instalment must be exactly 1 day overdue');
  assert.strictEqual(enrichedYesterday.overdueAmount, 500);

  // Due 5 days ago (2026-09-08)
  const inst5DaysAgo = {
    id: 'inst-2',
    dueAmount: 300,
    receivedAmount: 0,
    dueDate: '2026-09-08T00:00:00.000Z',
  };
  const enriched5DaysAgo = enrichInstalment(inst5DaysAgo, today);
  assert.strictEqual(enriched5DaysAgo.daysOverdue, 5, '5 days ago instalment must be 5 days overdue');

  // Due today (2026-09-13)
  const instToday = {
    id: 'inst-3',
    dueAmount: 300,
    receivedAmount: 0,
    dueDate: '2026-09-13T00:00:00.000Z',
  };
  const enrichedToday = enrichInstalment(instToday, today);
  assert.strictEqual(enrichedToday.daysOverdue, 0, 'Today instalment must be 0 days overdue');
  assert.strictEqual(enrichedToday.overdueAmount, 0, 'Today instalment must have 0 overdueAmount');
});

test('2. Type Filter vs Status Filter Mutual Exclusion Harmonization', () => {
  const todayISO = '2026-09-13';
  const rows = [
    {
      id: 'r1', source: 'today', dueDate: '2026-09-13T00:00:00.000Z',
      dueAmount: 300, receivedAmount: 0, outstandingAmount: 300, daysOverdue: 0,
      loan: { customer: { name: 'Alice', phone: '9876543210' }, loanCode: 'L1' }
    },
    {
      id: 'r2', source: 'overdue', dueDate: '2026-09-10T00:00:00.000Z',
      dueAmount: 500, receivedAmount: 0, outstandingAmount: 500, daysOverdue: 3,
      loan: { customer: { name: 'Bob', phone: '9123456789' }, loanCode: 'L2' }
    },
  ];

  // Default typeFilter: 'today'. User selects status: 'missed'.
  // Even if typeFilter is 'today', statusFilter 'missed' must NOT return 0 results!
  const res = filterRows(rows, { typeFilter: 'today', statusFilter: 'missed' }, todayISO);
  assert.strictEqual(res.length, 1, 'Should return the overdue row when statusFilter is missed');
  assert.strictEqual(res[0].id, 'r2');
});

test('3. Overdue Days (min) filter when typeFilter is today', () => {
  const todayISO = '2026-09-13';
  const rows = [
    { id: 'r1', source: 'today', dueDate: '2026-09-13T00:00:00.000Z', dueAmount: 300, receivedAmount: 0, outstandingAmount: 300, daysOverdue: 0, loan: {} },
    { id: 'r2', source: 'overdue', dueDate: '2026-09-08T00:00:00.000Z', dueAmount: 500, receivedAmount: 0, outstandingAmount: 500, daysOverdue: 5, loan: {} },
  ];

  const res = filterRows(rows, { typeFilter: 'today', overdueMinDays: '3' }, todayISO);
  assert.strictEqual(res.length, 1, 'Should match r2 with 5 days overdue');
  assert.strictEqual(res[0].id, 'r2');
});

test('4. Due Date filter matching against past date when typeFilter is today', () => {
  const todayISO = '2026-09-13';
  const rows = [
    { id: 'r1', source: 'today', dueDate: '2026-09-13T00:00:00.000Z', dueAmount: 300, receivedAmount: 0, outstandingAmount: 300, daysOverdue: 0, loan: {} },
    { id: 'r2', source: 'overdue', dueDate: '2026-09-10T00:00:00.000Z', dueAmount: 500, receivedAmount: 0, outstandingAmount: 500, daysOverdue: 3, loan: {} },
  ];

  const res = filterRows(rows, { typeFilter: 'today', dateFilter: '2026-09-10' }, todayISO);
  assert.strictEqual(res.length, 1, 'Should match r2 with dueDate 2026-09-10');
  assert.strictEqual(res[0].id, 'r2');
});

test('5. Customer / Loan search by phone number and route name', () => {
  const todayISO = '2026-09-13';
  const rows = [
    {
      id: 'r1', source: 'today', dueDate: '2026-09-13T00:00:00.000Z',
      dueAmount: 300, receivedAmount: 0, outstandingAmount: 300, daysOverdue: 0,
      loan: {
        loanCode: 'DL00015',
        customer: { name: 'Chithra', customerCode: 'CUS001', phone: '9842100000', route: { name: 'Chithode' } }
      }
    },
    {
      id: 'r2', source: 'today', dueDate: '2026-09-13T00:00:00.000Z',
      dueAmount: 500, receivedAmount: 0, outstandingAmount: 500, daysOverdue: 0,
      loan: {
        loanCode: 'DL00004',
        customer: { name: 'Dinesh', customerCode: 'CUS002', phone: '9443200000', route: { name: 'Erode Town' } }
      }
    }
  ];

  // Search by phone
  const byPhone = filterRows(rows, { customerFilter: '98421' }, todayISO);
  assert.strictEqual(byPhone.length, 1);
  assert.strictEqual(byPhone[0].id, 'r1');

  // Search by route name
  const byRoute = filterRows(rows, { customerFilter: 'Chithode' }, todayISO);
  assert.strictEqual(byRoute.length, 1);
  assert.strictEqual(byRoute[0].id, 'r1');

  // Search by loan code
  const byLoan = filterRows(rows, { customerFilter: 'DL00004' }, todayISO);
  assert.strictEqual(byLoan.length, 1);
  assert.strictEqual(byLoan[0].id, 'r2');
});

test('6. Route filter ID and routeId fallback matching', () => {
  const todayISO = '2026-09-13';
  const rows = [
    {
      id: 'r1', source: 'today', dueDate: '2026-09-13T00:00:00.000Z',
      dueAmount: 300, receivedAmount: 0, outstandingAmount: 300, daysOverdue: 0,
      loan: { customer: { route: { id: 'route-1', name: 'Route 1' } } }
    },
    {
      id: 'r2', source: 'today', dueDate: '2026-09-13T00:00:00.000Z',
      dueAmount: 500, receivedAmount: 0, outstandingAmount: 500, daysOverdue: 0,
      loan: { customer: { routeId: 'route-2', route: null } }
    }
  ];

  const res1 = filterRows(rows, { routeFilter: 'route-1' }, todayISO);
  assert.strictEqual(res1.length, 1);
  assert.strictEqual(res1[0].id, 'r1');

  const res2 = filterRows(rows, { routeFilter: 'route-2' }, todayISO);
  assert.strictEqual(res2.length, 1);
  assert.strictEqual(res2[0].id, 'r2');
});

test('7. Frequency and Session filter case-insensitivity and trim', () => {
  const todayISO = '2026-09-13';
  const rows = [
    {
      id: 'r1', source: 'today', dueDate: '2026-09-13T00:00:00.000Z',
      dueAmount: 300, receivedAmount: 0, outstandingAmount: 300, daysOverdue: 0,
      loan: { frequency: 'Daily', customer: { preferredCollectionTime: ' Morning ' } }
    },
    {
      id: 'r2', source: 'today', dueDate: '2026-09-13T00:00:00.000Z',
      dueAmount: 500, receivedAmount: 0, outstandingAmount: 500, daysOverdue: 0,
      loan: { frequency: 'weekly', customer: { preferredCollectionTime: null } }
    }
  ];

  // Frequency case insensitivity
  const daily = filterRows(rows, { frequencyFilter: 'daily' }, todayISO);
  assert.strictEqual(daily.length, 1);
  assert.strictEqual(daily[0].id, 'r1');

  // Session trim
  const morning = filterRows(rows, { sessionFilter: 'morning' }, todayISO);
  assert.strictEqual(morning.length, 1);
  assert.strictEqual(morning[0].id, 'r1');

  // Session anytime
  const anytime = filterRows(rows, { sessionFilter: 'anytime' }, todayISO);
  assert.strictEqual(anytime.length, 1);
  assert.strictEqual(anytime[0].id, 'r2');
});

console.log('--- ALL COLLECTION FILTER UNIT TESTS PASSED ---');
