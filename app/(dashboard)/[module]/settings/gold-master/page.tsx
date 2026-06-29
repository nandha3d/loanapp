import { serverFetch } from '@/lib/api-client/server';
import { getUserAppType } from '@/lib/tenant';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { modulePath } from '@/types/modules';
import GoldMasterClient from './GoldMasterClient';

export default async function GoldMasterPage() {
  const appType = await getUserAppType();
  const session = await auth();
  const role = (session?.user as any)?.role || 'agent';
  if (role === 'agent') redirect(modulePath(appType, '/collection'));

  let master: any = { ornamentTypes: [], ornamentSpecs: [], bankNames: [] };
  let config: any = null;
  try {
    const { getDefaultTenantId } = await import('@/lib/tenant');
    const { getGoldConfig } = await import('@/lib/gold/settings');
    const [res, cfg] = await Promise.all([
      serverFetch<any>('/gold/master').catch(() => null),
      getDefaultTenantId().then(getGoldConfig).catch(() => null),
    ]);
    if (res?.data) master = res.data;
    config = cfg;
  } catch { /* tolerate pre-migration */ }

  return <GoldMasterClient master={master} config={config} />;
}
