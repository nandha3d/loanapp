import { serverFetch } from '@/lib/api-client/server';
import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getTenantName } from '@/lib/tenant';
import LoanDetailClient from './LoanDetailClient';
import HpCustomer360 from './HpCustomer360';
import { notFound } from 'next/navigation';
import { formatDate } from '@/lib/utils';
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

  // Auto Finance Customer 360°: the split-row due chart, guarantors, asset
  // photos and print templates, plus the bulk-allocation receipt.
  let hp: {
    instalments: any[]; guarantors: any[]; photos: any[];
    registrationNo: string | null; rcDocPath: string | null;
  } | null = null;

  if (serializedLoan.appType === 'autofinance') {
    const [instalmentRows, penalties, detail, vehicle, guarantors] = await Promise.all([
      prisma.instalment.findMany({
        where: { loanId: serializedLoan.id },
        orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
        select: {
          id: true, instalmentNo: true, dueDate: true, dueAmount: true,
          receivedAmount: true, receivedAt: true, status: true, paymentMode: true,
        },
      }).catch(() => []),
      prisma.penalty.findMany({
        where: { loanId: serializedLoan.id, status: 'pending' },
        select: { instalmentId: true, grossPenalty: true, settledAmount: true, waivedAmount: true },
      }).catch(() => []),
      prisma.autoFinanceDetail.findUnique({
        where: { loanId: serializedLoan.id },
        select: { vehicleValue: true, downPayment: true, interestRate: true, interestMethod: true },
      }).catch(() => null),
      prisma.vehicle.findFirst({
        where: { loanId: serializedLoan.id, tenantId },
        select: { id: true, registrationNo: true, rcDocPath: true, photos: true },
      }).catch(() => null),
      prisma.guarantor.findMany({
        where: { customerId: serializedLoan.customerId },
        select: { id: true, name: true, phone: true, relation: true, address: true, photo: true },
      }).catch(() => []),
    ]);

    const penaltyByInstalment = new Map<string, number>();
    for (const p of penalties) {
      if (!p.instalmentId) continue;
      const outstanding = Math.max(
        0,
        Number(p.grossPenalty) - Number(p.settledAmount) - Number(p.waivedAmount),
      );
      penaltyByInstalment.set(p.instalmentId, (penaltyByInstalment.get(p.instalmentId) ?? 0) + outstanding);
    }

    // Split each instalment into its principal/interest components from the
    // origination terms, so the due chart can show the legal breakdown.
    const financed = detail?.vehicleValue != null && detail?.downPayment != null
      ? Number(detail.vehicleValue) - Number(detail.downPayment)
      : Number(serializedLoan.principal);
    const count = instalmentRows.length || 1;
    const principalPer = financed / count;

    hp = {
      instalments: instalmentRows.map((i) => {
        const due = Number(i.dueAmount);
        return {
          id: i.id,
          instalmentNo: i.instalmentNo,
          dueDate: i.dueDate,
          dueAmount: due,
          receivedAmount: Number(i.receivedAmount),
          receivedAt: i.receivedAt,
          status: i.status,
          paymentMode: i.paymentMode,
          receiptNo: null,
          principalComponent: Math.min(due, principalPer),
          interestComponent: Math.max(0, due - principalPer),
          penaltyOutstanding: penaltyByInstalment.get(i.id) ?? 0,
        };
      }),
      guarantors,
      photos: vehicle?.photos ?? [],
      registrationNo: vehicle?.registrationNo ?? null,
      rcDocPath: vehicle?.rcDocPath ?? null,
    };
  }

  return (
    <>
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
    {hp && (
      <HpCustomer360
        loanId={serializedLoan.id}
        loanCode={serializedLoan.loanCode}
        registrationNo={hp.registrationNo}
        instalments={hp.instalments}
        guarantors={hp.guarantors}
        photos={hp.photos}
        rcDocPath={hp.rcDocPath}
        currencySymbol={currencySymbol}
        canRecordReceipt={role !== 'agent'}
        formatDate={(d) => (d ? formatDate(d as any) : '—')}
      />
    )}
    </>
  );
}

