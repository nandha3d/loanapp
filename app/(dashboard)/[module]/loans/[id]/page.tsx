import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import LoanDetailClient from './LoanDetailClient';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/lib/i18n';
import { auth } from '@/lib/auth';
import { getActiveBranchId } from '@/lib/branch';
import { buildLoanDetailWhere } from '@/lib/loanPolicy';

export default async function LoanDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params;
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const activeBranchId = await getActiveBranchId();
  const session = await auth();
  const role = (session?.user as any)?.role || 'agent';
  const userId = session?.user?.id;
  const dict = await getDictionary(tenantId);
  
  const loan = await prisma.loan.findFirst({
    where: buildLoanDetailWhere({
      loanId: resolvedParams.id,
      tenantId,
      appType,
      branchId: activeBranchId,
      role,
      userId,
    }),
    include: {
      customer: {
        include: { 
          securityCheques: true,
          loans: {
            include: { instalments: true, penalties: true }
          }
        }
      },
      instalments: {
        include: {
          collectionEntry: { select: { id: true } }
        },
        orderBy: { instalmentNo: 'asc' }
      },
      penalties: true,
    }
  });

  if (!loan) {
    notFound();
  }

  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  // Serialize Decimal fields for client component
  const serializedLoan = JSON.parse(JSON.stringify(loan));

  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  const isReceiptPdfAllowed = sub?.receiptPdfAllowed || false;
  const isReceiptPdfActive = await getSetting(tenantId, 'receipt_pdf_active', 'false') === 'true';
  const receiptPdfEnabled = isReceiptPdfAllowed && isReceiptPdfActive;

  // Tenant's own UPI (for the in-modal pay QR) — no hardcoded placeholder.
  const [upiId, tenantRow] = await Promise.all([
    getSetting(tenantId, 'upi_id', ''),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
  ]);

  return (
    <LoanDetailClient
      loan={serializedLoan}
      currencySymbol={currencySymbol}
      dict={dict}
      userRole={role}
      userId={userId}
      receiptPdfEnabled={receiptPdfEnabled}
      upiId={upiId}
      payeeName={tenantRow?.name || 'LoanTrack'}
    />
  );
}
