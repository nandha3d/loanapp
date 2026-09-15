import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { modulePath } from '@/types/modules';
import { getIntegrationSettingsMasked } from '@/lib/integrations/settings';
import IntegrationsClient from './IntegrationsClient';

const ADMIN_ROLES = new Set(['admin', 'superadmin', 'developer']);

export default async function IntegrationsPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const appType = await getUserAppType();
  if (!session || !ADMIN_ROLES.has(role)) {
    redirect(modulePath(appType, '/collection'));
  }

  const tenantId = await getDefaultTenantId();
  const settings = await getIntegrationSettingsMasked(tenantId);
  const base = process.env.APP_PUBLIC_URL || process.env.NEXTAUTH_URL || '';

  return (
    <IntegrationsClient
      initial={settings}
      paymentGatewayUrl={modulePath(appType, '/settings/payment-gateway')}
      collectionsWebhookUrl={`${base}/api/webhooks/razorpay/collections`}
      nachWebhookUrl={`${base}/api/webhooks/razorpay/nach`}
    />
  );
}
