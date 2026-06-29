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
  try {
    const res = await serverFetch<any>('/gold/master');
    if (res?.data) master = res.data;
  } catch { /* tolerate pre-migration */ }

  return <GoldMasterClient master={master} />;
}
