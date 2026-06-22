import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const wallet = read('lib/wallet.ts');
assert.match(wallet, /export async function applyAccountingCashToBranch/, 'wallet exposes accounting-to-branch cash sync helper');
assert.match(wallet, /refType:\s*'account_entry'/, 'accounting cash sync writes wallet ledger rows linked to AccountEntry');
assert.match(wallet, /type:\s*isAddition \? 'inject' : 'adjustment'/, 'capital add/withdraw map to signed branch wallet deltas');

const accountingActions = read('app/(dashboard)/[module]/accounting/actions.ts');
assert.match(accountingActions, /syncsBranchCash.*capital_add.*capital_withdraw/s, 'basic accounting detects cash capital entries');
assert.match(accountingActions, /Select an active branch/, 'cash capital entries require active branch selection');
assert.match(accountingActions, /applyAccountingCashToBranch\(tx/, 'cash capital entries sync branch cash inside the AccountEntry transaction');
assert.match(accountingActions, /type:\s*'release'/, 'accounting summary reads agent release wallet transactions');
assert.match(accountingActions, /branchCashAvailable/, 'accounting summary exposes branch cash availability');
assert.match(accountingActions, /agentFloat/, 'accounting summary exposes agent float');

const walletPage = read('app/(dashboard)/[module]/wallet/page.tsx');
assert.match(walletPage, /accountEntry\.groupBy/, 'cash float reads accounting capital entries');
assert.match(walletPage, /releasedToAgents/, 'cash float reads release totals');
assert.match(walletPage, /branchCashAvailable/, 'cash float passes branch cash availability to client');

const walletClient = read('app/(dashboard)/[module]/wallet/WalletClient.tsx');
assert.match(walletClient, /Accounting cash capital/, 'cash float displays accounting cash capital KPI');
assert.match(walletClient, /Released to agents/, 'cash float displays released-to-agent KPI');
assert.match(walletClient, /Available branch cash/, 'cash float displays available branch cash KPI');

const webPasswordFiles = [
  'app/forgot-password/page.tsx',
  'app/login/page.tsx',
  'app/register/page.tsx',
  'app/reset-password/page.tsx',
  'app/admin/settings/SettingsClient.tsx',
  'app/admin/team/TeamClient.tsx',
  'app/admin/users/UsersClient.tsx',
  'app/borrower/dashboard/BorrowerDashboardClient.tsx',
  'app/borrower/login/page.tsx',
];
for (const file of webPasswordFiles) {
  assert.doesNotMatch(read(file), /type="password"/, `${file} should use PasswordInput or dynamic visibility`);
}
assert.match(read('components/ui/PasswordInput.tsx'), /visibility_off/, 'web PasswordInput exposes hide/show control');

const mobileTextField = read('mobile/lib/shared/widgets/app_text_field.dart');
assert.match(mobileTextField, /StatefulWidget/, 'Flutter AppTextField can manage password visibility state');
assert.match(mobileTextField, /visibility_outlined/, 'Flutter AppTextField renders a password visibility icon');
for (const file of [
  'mobile/lib/features/settings/payment_gateway_screen.dart',
  'mobile/lib/features/settings/settings_detail_screen.dart',
  'mobile/lib/features/admin/team_management_screen.dart',
  'mobile/lib/features/customers/new_customer_screen.dart',
]) {
  assert.match(read(file), /visibility_(off_)?outlined/, `${file} should expose a password/secret visibility toggle`);
}

const collectionClient = read('app/(dashboard)/[module]/collection/CollectionClient.tsx');
assert.match(collectionClient, /preferredCollectionTime\?: string \| null/, 'collection rows carry preferred collection time');
assert.match(collectionClient, /sessionFilter/, 'collection worklist has a session filter');
assert.match(collectionClient, /<option value="morning">Morning<\/option>/, 'collection session filter includes morning');
assert.match(collectionClient, /<option value="other">Other<\/option>/, 'collection session filter includes other');

const agentDashboardPage = read('app/(dashboard)/[module]/agent-dashboard/page.tsx');
const agentDashboardClient = read('app/(dashboard)/[module]/agent-dashboard/AgentDashboardClient.tsx');
assert.match(agentDashboardPage, /preferredCollectionTime: true/, 'agent dashboard fetches preferred collection time');
assert.match(agentDashboardClient, /sessionFilter/, 'agent dashboard exposes session filtering');

const newLoanForm = read('app/(dashboard)/[module]/loans/new/LoanForm.tsx');
const editLoanForm = read('app/(dashboard)/[module]/loans/[id]/edit/LoanEditForm.tsx');
assert.match(newLoanForm, /formatDateISO\(endDate\)/, 'new loan end date uses local ISO formatter');
assert.doesNotMatch(newLoanForm, /endDate\.toISOString\(\)\.split\('T'\)\[0\]/, 'new loan end date no longer uses UTC split formatting');
assert.match(editLoanForm, /formatDateISO\(new Date\(preview\.endDate\)\)/, 'edit loan calculated end date uses same formatter');

console.log('ui cash/session/password/date regression checks passed');
