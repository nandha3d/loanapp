import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const route = readFileSync(
  join(process.cwd(), 'app', 'api', 'v1', 'loans', 'route.ts'),
  'utf8',
);
const post = route.slice(route.indexOf('export async function POST'));

assert.match(post, /prisma\.\$transaction\(async \(tx\)/);
assert.match(post, /nextContractCode\(tx,/);
for (const model of [
  'loan',
  'guarantor',
  'goldLoanCollateral',
  'propertyCollateral',
  'productFinanceItem',
  'autoFinanceDetail',
  'vehicle',
  'vehiclePhoto',
  'auditLog',
  'accountEntry',
]) {
  assert.match(post, new RegExp(`(?:await )?tx\\.${model}\\.`), `${model} must use the origination transaction`);
}
assert.doesNotMatch(post, /persist failed for loan/);
assert.match(post, /existingGoldLoans = await tx\.loan\.findMany/);
assert.match(post, /isolationLevel:\s*'Serializable'/);
assert.match(post, /InsufficientFloatError/);
assert.match(post, /Branch is required to fund an active loan/);

console.log('origination atomicity contract tests passed');
