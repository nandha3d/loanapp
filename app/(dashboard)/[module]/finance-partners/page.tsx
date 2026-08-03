import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import { modulePath } from '@/types/modules';
import Link from '@/components/layout/DashboardLink';
import PartnersClient from './PartnersClient';

export default async function FinancePartnersPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();

  // Master data — agents never manage brokers or dealers.
  if ((session.user as any)?.role === 'agent') {
    redirect(modulePath(appType, '/collection'));
  }

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

  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');

  const partners = await prisma.financePartner.findMany({
    where: { tenantId, appType, deletedAt: null },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      type: true,
      name: true,
      phone: true,
      address: true,
      commissionRate: true,
      notes: true,
      status: true,
      _count: { select: { brokerLoans: true, dealerLoans: true } },
    },
  });

  const serialized = partners.map((p) => ({
    id: p.id,
    type: p.type,
    name: p.name,
    phone: p.phone,
    address: p.address,
    commissionRate: p.commissionRate != null ? p.commissionRate.toString() : null,
    notes: p.notes,
    status: p.status,
    loanCount: p.type === 'broker' ? p._count.brokerLoans : p._count.dealerLoans,
  }));

  return <PartnersClient partners={serialized} currencySymbol={currencySymbol} />;
}
