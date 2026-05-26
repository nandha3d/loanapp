import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId } from '@/lib/tenant';
import { isPremiumAccountingEnabled } from '@/lib/accounting/premium';
import SettingsClient from './SettingsClient';
import { getSettings, getBankAndCashAccounts, getMigrationStats } from './actions';

export default async function SettingsPage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const session = await auth();
  if (!session) redirect('/login');
  const role = (session.user as any)?.role;
  if (!['superadmin','developer'].includes(role)) redirect(`/${module}`);

  const tenantId = await getDefaultTenantId();
  const enabled = await isPremiumAccountingEnabled(tenantId);
  if (!enabled) redirect(`/${module}/accounting`);

  const [settings, { bankAccounts, cashAccounts }, migrationStats] = await Promise.all([
    getSettings(),
    getBankAndCashAccounts(),
    getMigrationStats(),
  ]);

  return <SettingsClient settings={settings as any} bankAccounts={bankAccounts} cashAccounts={cashAccounts} migrationStats={migrationStats} />;
}
