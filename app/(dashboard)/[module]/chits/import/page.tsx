import { auth } from '@/lib/auth';
import { canAdminChits } from '@/lib/chits/access';
import { getChitTypeSettings } from '@/lib/chits/settings';
import { requireModule } from '@/lib/moduleGate';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { modulePath } from '@/types/modules';
import Link from '@/components/layout/DashboardLink';
import { redirect } from 'next/navigation';
import ChitImportClient from './ChitImportClient';

export default async function ImportChitFromWhatsAppPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const appType = await getUserAppType();
  const role = (session.user as any)?.role as string | undefined;
  const staffPermissions = (session.user as any)?.staffPermissions ?? null;
  if (!canAdminChits(role, staffPermissions)) redirect(modulePath(appType, '/chits'));

  const tenantId = await getDefaultTenantId();
  try {
    await requireModule(tenantId, 'chitfunds');
  } catch {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
        <h3>Module Not Enabled</h3>
        <Link href="/subscription" className="btn btn-primary">View Subscription</Link>
      </div>
    );
  }

  const [currencySymbol, settings] = await Promise.all([
    getSetting(tenantId, 'currency_symbol', '₹'),
    getChitTypeSettings(tenantId),
  ]);

  return (
    <ChitImportClient
      currencySymbol={currencySymbol}
      enabledChitTypes={settings.enabledTypes}
    />
  );
}
