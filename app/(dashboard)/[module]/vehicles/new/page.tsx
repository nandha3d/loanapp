import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import VehicleForm from './VehicleForm';
import { getDictionary } from '@/lib/i18n';
import Link from '@/components/layout/DashboardLink';

export default async function NewVehiclePage() {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  try {
    await requireModule(tenantId, 'autofinance');
  } catch {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
        <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--border)' }}>lock</span>
        <h3 style={{ margin: '16px 0 8px' }}>Module Not Enabled</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
          The Auto Finance module is not included in your current subscription plan.
        </p>
        <Link href="/subscription" className="btn btn-primary">View Subscription</Link>
      </div>
    );
  }
  const dict = await getDictionary(tenantId);

  const [customers, loans] = await Promise.all([
    prisma.customer.findMany({
      where: { tenantId, appType, status: 'active' },
      select: { id: true, name: true, customerCode: true },
      orderBy: { name: 'asc' },
    }),
    prisma.loan.findMany({
      where: { tenantId, appType, status: 'active', vehicle: null },
      select: { id: true, loanCode: true, customerId: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <div>
      <VehicleForm customers={customers} loans={loans} dict={dict} />
    </div>
  );
}
