import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';
import { isPremiumAccountingEnabled } from '@/lib/accounting/premium';
import { redirect } from 'next/navigation';
import { modulePath } from '@/types/modules';
import PremiumNav from './PremiumNav';

export const metadata = { title: 'Accounting' };

export default async function PremiumAccountingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || !role) redirect('/login');
  if (role === 'agent') redirect(modulePath(module, '/dashboard'));

  const tenantId = await getDefaultTenantId();
  const enabled = await isPremiumAccountingEnabled(tenantId);

  if (!enabled) {
    return (
      <div style={{ padding: '3rem 2rem', maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📊</div>
        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>Full Accounting Suite</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0.75rem 0 1.5rem', lineHeight: 1.6 }}>
          Double-entry ledger, P&amp;L, Balance Sheet, GSTR-3B, TDS registers,
          bank reconciliation, vendor bills and budget tracking.
        </p>
        <a href={modulePath(module, '/module-requests')} className="btn btn-primary">
          Request Access
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ padding: 0, marginBottom: 18, overflow: 'hidden' }}>
        <PremiumNav module={module} />
      </div>
      {children}
    </div>
  );
}
