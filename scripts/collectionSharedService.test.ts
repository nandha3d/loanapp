import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

const shared = source('lib/collectionWrite.ts');
const v1EntryRoute = source('app/api/v1/collection/entry/route.ts');
const webCollectionRoute = source('app/api/collection/route.ts');

assert.match(
  shared,
  /export async function submitCollectionEntry/,
  'single-entry collection writes live in the shared collection service',
);

for (const [label, route] of [
  ['mobile v1 entry route', v1EntryRoute],
  ['web collection route', webCollectionRoute],
] as const) {
  assert.match(route, /submitCollectionEntry/, `${label} delegates single-entry writes`);
  assert.doesNotMatch(route, /recordPaymentLedger/, `${label} does not post ledgers inline`);
  assert.doesNotMatch(route, /reallocateLoanRepayments/, `${label} does not reallocate repayments inline`);
  assert.doesNotMatch(route, /collectionEntry\.create/, `${label} does not create collection entries inline`);
  assert.doesNotMatch(route, /creditCollection/, `${label} does not credit wallet float inline`);
}

console.log('collection shared service architecture checks passed');
