import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { normalizeEnabledModules } from '@/lib/subscription';
import SubscriptionForm from './SubscriptionForm';

export default async function TenantBillingPage({ params }: { params: { tenantId: string } }) {
  const { tenantId } = await params;
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'developer') redirect('/portal');

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: true },
  });
  if (!tenant) notFound();

  const sub = tenant.subscription;
  const enabledModulesList = normalizeEnabledModules(sub?.enabledModules);

  return (
    <div className="card" style={{ maxWidth: '560px' }}>
      <div className="card-header">
        <h3>Manage Subscription — {tenant.name}</h3>
      </div>

      <SubscriptionForm 
        key={`${tenantId}-${sub?.id || 'new'}-${sub?.updatedAt?.getTime() || 0}`}
        tenantId={tenantId}
        tenantName={tenant.name}
        subscription={sub}
        enabledModules={enabledModulesList}
      />
    </div>
  );
}
