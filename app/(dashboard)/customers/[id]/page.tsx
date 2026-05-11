import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting } from '@/lib/tenant';
import CustomerProfileClient from './CustomerProfileClient';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function CustomerProfilePage({
  params
}: {
  params: { id: string }
}) {
  const resolvedParams = await params;
  const tenantId = await getDefaultTenantId();
  const session = await auth();
  const userRole = (session?.user as any)?.role || 'agent';
  
  const customer = await prisma.customer.findUnique({
    where: { id: resolvedParams.id, tenantId },
    include: {
      route: true,
      agent: true,
      securityCheques: true,
      loans: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!customer) {
    notFound();
  }

  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');

  // Serialize Decimal fields for client component
  const serializedCustomer = JSON.parse(JSON.stringify(customer));

  return <CustomerProfileClient customer={serializedCustomer} currencySymbol={currencySymbol} userRole={userRole} />;
}
