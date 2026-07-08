import { serverFetch } from '@/lib/api-client/server';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import CustomerProfileClient from './CustomerProfileClient';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDictionary } from '@/lib/i18n';
import { getSubscription } from '@/lib/subscription';

export default async function CustomerProfilePage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params;
  const tenantId = await getDefaultTenantId();
  const session = await auth();
  const userRole = (session?.user as any)?.role || 'agent';
  const dict = await getDictionary(tenantId);
  
  let customer: any = null;
  try {
    const res = await serverFetch<any>(`/customers/${resolvedParams.id}`);
    customer = res?.data;
  } catch (err) {
    // If not found
  }

  if (!customer) {
    notFound();
  }

  // ── Canonical Redirect ─────────────────────────────────────────────────────
  if (resolvedParams.id === customer.id && customer.customerCode !== customer.id) {
    redirect(`/customers/${customer.customerCode}`);
  }

  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const sub = await getSubscription(tenantId);
  const kycEnabled = sub?.kycEnabled || false;
  const tenantKycMethod = await getSetting(tenantId, 'kyc_method', 'manual_upload');
  // Chitfunds is chit-only — no loan origination, so hide loan affordances.
  const appType = await getUserAppType();
  const loansEnabled = appType !== 'chitfunds';

  // Serialize Decimal fields for client component
  const serializedCustomer = JSON.parse(JSON.stringify(customer));

  return (
    <CustomerProfileClient
      customer={serializedCustomer}
      currencySymbol={currencySymbol}
      userRole={userRole}
      dict={dict}
      kycEnabled={kycEnabled}
      tenantKycMethod={tenantKycMethod}
      loansEnabled={loansEnabled}
    />
  );
}
