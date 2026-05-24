import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import CustomerProfileClient from './CustomerProfileClient';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { decryptAadharNumber, maskAadharNumber } from '@/lib/pii';
import { getDictionary } from '@/lib/i18n';

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
  
  // Support both ID and Customer Code as slug
  const customer = await prisma.customer.findFirst({
    where: {
      tenantId,
      OR: [
        { id: resolvedParams.id },
        { customerCode: resolvedParams.id }
      ]
    },
    include: {
      route: true,
      agent: true,
      securityCheques: true,
      guarantors: true,
      loans: {
        include: {
          instalments: { select: { status: true, receivedAmount: true } },
          penalties: { select: { id: true } }
        },
        orderBy: { createdAt: 'desc' }
      },
      kycSessions: {
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    }
  });

  if (!customer) {
    notFound();
  }

  // ── Canonical Redirect ─────────────────────────────────────────────────────
  // If the URL uses the UUID instead of the customerCode, redirect to canonical.
  if (resolvedParams.id === customer.id && customer.customerCode !== customer.id) {
    redirect(`/customers/${customer.customerCode}`);
  }
  // ───────────────────────────────────────────────────────────────────────────

  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  const kycEnabled = sub?.kycEnabled || false;
  const tenantKycMethod = await getSetting(tenantId, 'kyc_method', 'manual_upload');

  // Serialize Decimal fields for client component
  const serializedCustomer = JSON.parse(JSON.stringify(customer));
  serializedCustomer.aadharNumber = maskAadharNumber(decryptAadharNumber(customer.aadharNumber));
  serializedCustomer.guarantors = serializedCustomer.guarantors?.map((guarantor: any) => ({
    ...guarantor,
    aadharNumber: maskAadharNumber(decryptAadharNumber(guarantor.aadharNumber)),
  }));

  return (
    <CustomerProfileClient
      customer={serializedCustomer}
      currencySymbol={currencySymbol}
      userRole={userRole}
      dict={dict}
      kycEnabled={kycEnabled}
      tenantKycMethod={tenantKycMethod}
    />
  );

}
