import test from 'node:test';
import assert from 'node:assert/strict';

test('Collection route switcher logic: dynamic totals and customer progress per route', () => {
  const routes = [
    { id: 'route-erode', name: 'Erode' },
    { id: 'route-chithode', name: 'Chithode' },
  ];

  const todayInstalments = [
    {
      id: 'inst-1',
      dueAmount: 1000,
      receivedAmount: 1000,
      outstandingAmount: 0,
      dueDate: '2026-09-13',
      source: 'today',
      loan: {
        id: 'l-1',
        customer: { id: 'cust-1', name: 'Ravi', route: { id: 'route-erode', name: 'Erode' } },
      },
    },
    {
      id: 'inst-2',
      dueAmount: 500,
      receivedAmount: 0,
      outstandingAmount: 500,
      dueDate: '2026-09-13',
      source: 'today',
      loan: {
        id: 'l-2',
        customer: { id: 'cust-2', name: 'Priya', route: { id: 'route-erode', name: 'Erode' } },
      },
    },
    {
      id: 'inst-3',
      dueAmount: 2000,
      receivedAmount: 500,
      outstandingAmount: 1500,
      dueDate: '2026-09-13',
      source: 'today',
      loan: {
        id: 'l-3',
        customer: { id: 'cust-3', name: 'Kumar', route: { id: 'route-chithode', name: 'Chithode' } },
      },
    },
  ];

  const overdueInstalments = [
    {
      id: 'inst-4',
      dueAmount: 3000,
      receivedAmount: 0,
      outstandingAmount: 3000,
      overdueAmount: 3000,
      daysOverdue: 15,
      dueDate: '2026-08-29',
      source: 'overdue',
      loan: {
        id: 'l-4',
        customer: { id: 'cust-4', name: 'Suresh', route: { id: 'route-erode', name: 'Erode' } },
      },
    },
    {
      id: 'inst-5',
      dueAmount: 1000,
      receivedAmount: 200,
      outstandingAmount: 800,
      overdueAmount: 800,
      daysOverdue: 5,
      dueDate: '2026-09-08',
      source: 'overdue',
      loan: {
        id: 'l-5',
        customer: { id: 'cust-5', name: 'Meena', route: { id: 'route-chithode', name: 'Chithode' } },
      },
    },
  ];

  function rowMatchesRoute(row: any, targetRoute: string) {
    if (!targetRoute) return true;
    const custRouteId = row.loan?.customer?.route?.id;
    const custRouteName = row.loan?.customer?.route?.name;
    return custRouteId === targetRoute || custRouteName === targetRoute;
  }

  // 1. Check All Routes totals
  const allTodayDue = todayInstalments.reduce((s, r) => s + r.dueAmount, 0); // 1000 + 500 + 2000 = 3500
  const allTodayCollected = todayInstalments.reduce((s, r) => s + r.receivedAmount, 0); // 1000 + 0 + 500 = 1500
  const allTodayOutstanding = Math.max(0, allTodayDue - allTodayCollected); // 2000
  assert.equal(allTodayDue, 3500);
  assert.equal(allTodayCollected, 1500);
  assert.equal(allTodayOutstanding, 2000);

  // 2. Filter by Route: Erode
  const erodeToday = todayInstalments.filter((r) => rowMatchesRoute(r, 'route-erode'));
  const erodeDue = erodeToday.reduce((s, r) => s + r.dueAmount, 0); // 1000 + 500 = 1500
  const erodeCollected = erodeToday.reduce((s, r) => s + r.receivedAmount, 0); // 1000 + 0 = 1000
  const erodeOutstanding = Math.max(0, erodeDue - erodeCollected); // 500
  const erodePendingCount = erodeToday.filter((r) => r.outstandingAmount > 0).length; // 1

  assert.equal(erodeDue, 1500);
  assert.equal(erodeCollected, 1000);
  assert.equal(erodeOutstanding, 500);
  assert.equal(erodePendingCount, 1);

  // Erode Overdue
  const erodeOverdue = overdueInstalments.filter((r) => rowMatchesRoute(r, 'route-erode'));
  const erodeOverdueAmount = erodeOverdue.reduce((s, r) => s + r.outstandingAmount, 0); // 3000
  const erodeOverdueCount = erodeOverdue.filter((r) => r.outstandingAmount > 0).length; // 1
  const erodeMaxDays = erodeOverdue.reduce((m, r) => Math.max(m, r.daysOverdue), 0); // 15
  assert.equal(erodeOverdueAmount, 3000);
  assert.equal(erodeOverdueCount, 1);
  assert.equal(erodeMaxDays, 15);

  // Erode customer progress
  const erodeCustDue = new Set(erodeToday.map((r) => r.loan.customer.id)); // cust-1, cust-2
  const erodeCustDone = new Set(erodeToday.filter((r) => r.outstandingAmount <= 0).map((r) => r.loan.customer.id)); // cust-1
  assert.equal(erodeCustDue.size, 2);
  assert.equal(erodeCustDone.size, 1);

  // 3. Filter by Route: Chithode
  const chithodeToday = todayInstalments.filter((r) => rowMatchesRoute(r, 'route-chithode'));
  const chithodeDue = chithodeToday.reduce((s, r) => s + r.dueAmount, 0); // 2000
  const chithodeCollected = chithodeToday.reduce((s, r) => s + r.receivedAmount, 0); // 500
  const chithodeOutstanding = 1500;
  assert.equal(chithodeDue, 2000);
  assert.equal(chithodeCollected, 500);
  assert.equal(chithodeOutstanding, 1500);

  const chithodeOverdue = overdueInstalments.filter((r) => rowMatchesRoute(r, 'route-chithode'));
  const chithodeOverdueAmount = chithodeOverdue.reduce((s, r) => s + r.outstandingAmount, 0); // 800
  const chithodeMaxDays = chithodeOverdue.reduce((m, r) => Math.max(m, r.daysOverdue), 0); // 5
  assert.equal(chithodeOverdueAmount, 800);
  assert.equal(chithodeMaxDays, 5);

  console.log('Collection route switcher tests passed successfully!');
});
