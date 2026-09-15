import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { calculateChitAccountingMetrics } from '../lib/accounting/chitSummary';

const metrics = calculateChitAccountingMetrics({
  groups: [
    { status: 'active', chitValue: 100000, startDate: '2026-01-01' },
    { status: 'closed', chitValue: 50000, startDate: '2025-01-01' },
  ],
  subscriptions: [
    { dueDate: '2026-07-05', paidAt: '2026-07-06', dueAmount: 1000, dividendAmount: 100, interestAmount: 20, penaltyAmount: 10, paidAmount: 500 },
    { dueDate: '2026-06-05', paidAt: '2026-06-06', dueAmount: 1000, dividendAmount: 0, interestAmount: 0, penaltyAmount: 0, paidAmount: 1000 },
  ],
  auctions: [
    { auctionDate: '2026-07-10', completedAt: '2026-07-10', status: 'completed', prizeAmount: 80000, dividend: 15000 },
    { auctionDate: '2026-06-10', completedAt: '2026-06-10', status: 'completed', prizeAmount: 70000, dividend: 12000 },
  ],
  fromDate: '2026-07-01',
  toDate: '2026-07-31',
});

assert.deepEqual(metrics, {
  activeChitValue: 100000,
  contributionsCollected: 500,
  subscriptionReceivable: 430,
  prizePayouts: 80000,
  dividendsDistributed: 15000,
  activeGroups: 1,
});

const actionsSource = readFileSync(join(process.cwd(), 'app/(dashboard)/[module]/accounting/actions.ts'), 'utf8');
const clientSource = readFileSync(join(process.cwd(), 'app/(dashboard)/[module]/accounting/AccountingClient.tsx'), 'utf8');
const pageSource = readFileSync(join(process.cwd(), 'app/(dashboard)/[module]/accounting/page.tsx'), 'utf8');
assert.match(actionsSource, /kind: 'chit'/, 'accounting must return an explicit chit summary variant');
for (const label of ['Active Chit Value', 'Contributions Collected', 'Subscription Receivable', 'Prize Payouts', 'Dividends Distributed', 'Active Groups']) {
  assert.match(clientSource, new RegExp(label), `chit accounting must render ${label}`);
}
assert.match(pageSource, /chit contributions, auction payouts, dividends, and expenses/, 'chit accounting subtitle must use chit vocabulary');

console.log('chit accounting summary tests passed');
