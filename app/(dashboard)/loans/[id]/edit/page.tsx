import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting } from '@/lib/tenant';
import { getDictionary } from '@/lib/i18n';
import LoanEditForm from './LoanEditForm';
import { notFound } from 'next/navigation';

export default async function EditLoanPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params;
  const tenantId = await getDefaultTenantId();
  const dict = await getDictionary(tenantId);
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');

  const loan = await prisma.loan.findFirst({
    where: { id: resolvedParams.id, tenantId },
    include: {
      customer: true,
      guarantor: true
    }
  });

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
        dict={dict}
      />
    </div>
  );
}
