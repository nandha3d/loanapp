import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting } from '@/lib/tenant';
import LoanDetailClient from './LoanDetailClient';
import { notFound } from 'next/navigation';

export default async function LoanDetailPage({
  params
}: {
  params: { id: string }
}) {
  const resolvedParams = await params;
  const tenantId = await getDefaultTenantId();
  
  const loan = await prisma.loan.findUnique({
    where: { id: resolvedParams.id, tenantId },
    include: {
      customer: {
        include: { securityCheques: true }
      },
      instalments: {
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

  return <LoanDetailClient loan={serializedLoan} currencySymbol={currencySymbol} />;
}
