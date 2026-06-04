import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import ChitGroupForm from './ChitGroupForm';
import { getDictionary } from '@/lib/i18n';
import Link from '@/components/layout/DashboardLink';

export default async function NewChitGroupPage() {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  try {
    await requireModule(tenantId, 'chitfunds');
  } catch {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
        <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--border)' }}>lock</span>
        <h3 style={{ margin: '16px 0 8px' }}>Module Not Enabled</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
          The Chit Funds module is not included in your current subscription plan.
        </p>
        <Link href="/subscription" className="btn btn-primary">View Subscription</Link>
      </div>
    );
  }
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const dict = await getDictionary(tenantId);

  const customers = await prisma.customer.findMany({
    where: { tenantId, appType, status: 'active' },
    select: { id: true, name: true, customerCode: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div>
      <ChitGroupForm customers={customers} currencySymbol={currencySymbol} dict={dict} />
    </div>
  );
}
