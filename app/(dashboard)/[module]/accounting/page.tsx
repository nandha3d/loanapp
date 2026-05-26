import { auth } from '@/lib/auth';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import AccountingClient from './AccountingClient';
import { getAccountingSummary } from './actions';
import { getActiveBranchId } from '@/lib/branch';
import { modulePath } from '@/types/modules';
import { getDictionary } from '@/lib/i18n';
import { isPremiumAccountingEnabled } from '@/lib/accounting/premium';

export default async function AccountingPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const appType = await getUserAppType();
  if (!role || role === 'agent') redirect(modulePath(appType, '/collection'));

  const tenantId = await getDefaultTenantId();
  const premiumEnabled = await isPremiumAccountingEnabled(tenantId);

  // Premium takes over — redirect entirely
  if (premiumEnabled) redirect(`/${appType}/accounting/premium`);

  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const activeBranchId = await getActiveBranchId();
  const dict = await getDictionary(tenantId);
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
      <AccountingClient summary={serializedSummary} currencySymbol={currencySymbol} dict={dict} />
    </div>
  );
}
