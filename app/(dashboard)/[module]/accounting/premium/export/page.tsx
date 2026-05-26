import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import { isPremiumAccountingEnabled, getOrCreateAccountingSettings } from '@/lib/accounting/premium';
import { listExportRuns } from './actions';
import ExportClient from './ExportClient';

export const metadata = { title: 'Premium Accounting · Export' };

export default async function ExportPage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;

  const session = await auth();
  if (!session) redirect('/login');
  const user = session.user as any;

  if (!['superadmin', 'developer'].includes(user.role)) {
    redirect(`/${module}/accounting/premium`);
  }

  const tenantId = await getDefaultTenantId();
  const enabled = await isPremiumAccountingEnabled(tenantId);
  if (!enabled) redirect(`/${module}/accounting`);

  const [settings, exportRuns] = await Promise.all([
    getOrCreateAccountingSettings(tenantId),
    listExportRuns(),
  ]);

  return (
    <ExportClient
      module={module}
      exportRuns={exportRuns}
      settings={{
        tallyConnectorEnabled: settings.tallyConnectorEnabled ?? false,
        tallyConnectorUrl: settings.tallyConnectorUrl ?? null,
        tallyCompanyName: settings.tallyCompanyName ?? null,
      }}
    />
  );
}
