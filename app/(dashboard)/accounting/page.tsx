import { auth } from '@/lib/auth';
import { getDefaultTenantId, getSetting } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import AccountingClient from './AccountingClient';
import { getAccountingSummary } from './actions';
import { getActiveBranchId } from '@/lib/branch';

export default async function AccountingPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!role || role === 'agent') redirect('/collection');

  const tenantId = await getDefaultTenantId();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const activeBranchId = await getActiveBranchId();
  const summary = await getAccountingSummary(tenantId, activeBranchId);

  // Serialize Decimal fields
  const serializedSummary = JSON.parse(JSON.stringify(summary));

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>📊 Accounting & P&L</h2>
        <p style={{ margin: '4px 0 0', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
          Track capital flow, loan disbursements, collections, and expenses.
        </p>
      </div>
      <AccountingClient summary={serializedSummary} currencySymbol={currencySymbol} />
    </div>
  );
}
