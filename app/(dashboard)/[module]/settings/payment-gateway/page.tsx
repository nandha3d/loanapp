import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getSetting } from '@/lib/tenant';
import { getTenantRazorpayConfigMasked } from '@/lib/tenantRazorpay';
import { modulePath } from '@/types/modules';
import GatewayForm from './GatewayForm';

/** Per-tenant collections config: Tier-0 UPI + Razorpay gateway. Admin only. */
export default async function PaymentGatewayPage({ params }: { params: Promise<{ module: string }> }) {
  const session = await auth();
  if (!session) redirect('/login');
  const { module } = await params;
  const role = (session.user as { role?: string })?.role;
  if (!['admin', 'superadmin', 'developer'].includes(role ?? '')) redirect(modulePath(module, '/dashboard'));

  const tenantId = await getDefaultTenantId();
  const [config, upiId] = await Promise.all([
    getTenantRazorpayConfigMasked(tenantId),
    getSetting(tenantId, 'upi_id', ''),
  ]);
  const base = process.env.APP_PUBLIC_URL || process.env.NEXTAUTH_URL || '';
  const webhookUrl = `${base}/api/webhooks/razorpay/collections`;

  return <GatewayForm config={config} upiId={upiId} webhookUrl={webhookUrl} />;
}
