import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const events = readFileSync(join(process.cwd(), 'lib/notify/events.ts'), 'utf8');
const requiredEvents = [
  'chit_contribution_received',
  'chit_subscription_due',
  'chit_auction_reminder_day',
  'chit_auction_reminder_hour',
  'chit_auction_result',
  'chit_dividend_posted',
];

for (const event of requiredEvents) {
  assert.match(events, new RegExp(`'${event}'`), `EventKey must include ${event}`);
  assert.match(events, new RegExp(`lt_${event}`), `WhatsApp mapping must include ${event}`);
}
for (const field of ['resultNotifiedAt', 'dividendNotifiedAt', 'reminderDayBeforeAt', 'reminderDueDayAt']) {
  assert.match(schema, new RegExp(field), `schema must include ${field}`);
}

console.log('chit notification contract tests passed');
