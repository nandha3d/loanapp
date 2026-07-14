import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildChitCustomerProfile } from '../lib/chits/customerSummary';

const profile = buildChitCustomerProfile([
  {
    id: 'member-1',
    memberNumber: 7,
    ticketNo: 'T-007',
    subscriberStatus: 'active',
    hasWon: true,
    chitGroup: { id: 'group-1', groupCode: 'CH-1', name: 'Starter Chit', status: 'active' },
    subscriptions: [
      { dueAmount: 1000, dividendAmount: 100, interestAmount: 20, penaltyAmount: 10, paidAmount: 500 },
      { dueAmount: 1000, dividendAmount: 0, interestAmount: 0, penaltyAmount: 0, paidAmount: 1000 },
    ],
  },
  {
    id: 'member-2',
    memberNumber: 8,
    ticketNo: null,
    subscriberStatus: 'closed',
    hasWon: false,
    chitGroup: { id: 'group-2', groupCode: null, name: 'Closed Chit', status: 'closed' },
    subscriptions: [
      { dueAmount: 800, dividendAmount: 100, interestAmount: 0, penaltyAmount: 0, paidAmount: 900 },
    ],
  },
]);

assert.deepEqual(profile.summary, {
  activeChits: 1,
  totalContributed: 2400,
  outstandingSubscriptionDue: 430,
  prizedChits: 1,
});
assert.equal(profile.memberships[0].contributed, 1500);
assert.equal(profile.memberships[0].outstandingSubscriptionDue, 430);
assert.equal(profile.memberships[0].ticket, 'T-007');
assert.equal(profile.memberships[1].ticket, '8');

const pageSource = readFileSync(
  join(process.cwd(), 'app/(dashboard)/[module]/customers/[id]/page.tsx'),
  'utf8',
);
const clientSource = readFileSync(
  join(process.cwd(), 'app/(dashboard)/[module]/customers/[id]/CustomerProfileClient.tsx'),
  'utf8',
);
assert.match(pageSource, /buildChitCustomerProfile/, 'profile page must build a tenant-scoped chit profile');
assert.match(pageSource, /appType=\{appType\}/, 'profile client must receive the app type');
for (const label of ['Active Chits', 'Total Contributed', 'Outstanding Subscription Due', 'Prized Chits', 'Chit Memberships']) {
  assert.match(clientSource, new RegExp(label), `chit profile must render ${label}`);
}
assert.match(clientSource, /isChit \? 'chits'/, 'chit memberships must be the default chit profile tab');

console.log('chit customer summary tests passed');
