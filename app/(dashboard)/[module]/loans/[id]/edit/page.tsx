import { serverFetch } from '@/lib/api-client/server';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { isInterestOnlyEnabled } from '@/lib/features';
import { getDictionary } from '@/lib/i18n';
import LoanEditForm from './LoanEditForm';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function EditLoanPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params;
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const dict = await getDictionary(tenantId);
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');

  const session = await auth();
  const role = (session?.user as any)?.role || 'agent';

  let loan: any = null;
  try {
    const res = await serverFetch<any>(`/loans/${resolvedParams.id}`);
    loan = res?.data;
  } catch (err) {
    // If not found
  }

  if (!loan) {
    notFound();
  }

  // Serialize Decimal fields
  const serializedLoan = JSON.parse(JSON.stringify(loan));

  return (
    <div className="container" style={{ padding: '20px' }}>
      <LoanEditForm 
        loan={serializedLoan} 
        currencySymbol={currencySymbol}
        appType={appType}
        dict={dict}
        userRole={role}
        interestOnlyEnabled={await isInterestOnlyEnabled(tenantId)}
      />
    </div>
  );
}

