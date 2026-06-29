import { serverFetch } from '@/lib/api-client/server';
import { getDefaultTenantId, getSetting, getTenantName } from '@/lib/tenant';
import LoanDetailClient from './LoanDetailClient';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/lib/i18n';
import { auth } from '@/lib/auth';
import { getSubscription } from '@/lib/subscription';

export default async function LoanDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params;
  const tenantId = await getDefaultTenantId();
  const session = await auth();
  const role = (session?.user as any)?.role || 'agent';
  const userId = session?.user?.id;
  const dict = await getDictionary(tenantId);
  
  let loan: any = null;
  try {
    const res = await serverFetch<any>(`/loans/${resolvedParams.id}`);
    loan = res?.data;
  } catch (err) {
    // If not found or API fails
  }

  if (!loan) {
    notFound();
  }

  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  // Serialize Decimal fields for client component
  const serializedLoan = JSON.parse(JSON.stringify(loan));

  // Gold pledge servicing summary (outstanding / interest due / redemption).
  let goldServicing: any = null;
  if (serializedLoan.appType === 'goldloan') {
    try {
      const gs = await serverFetch<any>(`/gold/loans/${serializedLoan.id}/servicing`);
      goldServicing = gs?.data ?? null;
    } catch {
      goldServicing = null;
    }
  }

  const sub = await getSubscription(tenantId);
  const isReceiptPdfAllowed = sub?.receiptPdfAllowed || false;
  const isReceiptPdfActive = await getSetting(tenantId, 'receipt_pdf_active', 'false') === 'true';
  const receiptPdfEnabled = isReceiptPdfAllowed && isReceiptPdfActive;

  // Tenant's own UPI (for the in-modal pay QR)
  const upiId = await getSetting(tenantId, 'upi_id', '');
  const tenantName = await getTenantName(tenantId);

  return (
    <LoanDetailClient
      loan={serializedLoan}
      currencySymbol={currencySymbol}
      dict={dict}
      userRole={role}
      userId={userId}
      receiptPdfEnabled={receiptPdfEnabled}
      upiId={upiId}
      payeeName={tenantName}
      goldServicing={goldServicing}
    />
  );
}

