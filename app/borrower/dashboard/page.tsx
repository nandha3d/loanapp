import { getBorrowerSession } from '@/lib/borrowerAuth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import BorrowerDashboardClient from './BorrowerDashboardClient';
import ChitOnlyPanel from './ChitOnlyPanel';
import PaymentProofPanel from './PaymentProofPanel';
import { getDictionary } from '@/lib/i18n';
import { getMyChitMemberships } from '@/lib/chits/customerPortal';

export default async function BorrowerDashboard() {
  const session = await getBorrowerSession();

  if (!session) {
    redirect('/borrower/login');
  }

  const loans = await prisma.loan.findMany({
    where: {
      customerId: session.customerId,
      tenantId: session.tenantId,
    },
    include: {
      customer: true,
      instalments: {
        orderBy: { instalmentNo: 'asc' },
        include: {
          collectionEntry: {
            include: {
              agent: true,
            },
          },
        },
      },
      payments: {
        orderBy: { paymentDate: 'desc' },
      },
      vehicle: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Module-aware: a customer can belong to loans, chits, or both — never
  // assume every login is a loan borrower.
  const chitMemberships = await getMyChitMemberships(session.customerId, session.tenantId);

  if (loans.length === 0 && chitMemberships.length === 0) {
    redirect('/borrower/login');
  }

  if (loans.length === 0) {
    return <ChitOnlyPanel memberships={chitMemberships} />;
  }

  // Fetch payment/UPI settings for custom QR display
  const settingsList = await prisma.appSetting.findMany({
    where: {
      tenantId: session.tenantId,
      key: {
        in: ['upi_id', 'upi_qr_url'],
      },
    },
  });

  const paymentSettings = {
    upiId: settingsList.find((s) => s.key === 'upi_id')?.value || '',
    upiQrUrl: settingsList.find((s) => s.key === 'upi_qr_url')?.value || '',
  };

  // Convert rich Prisma types (Decimal, Date) to plain JSON objects for Client Components compatibility
  const serializedLoans = JSON.parse(JSON.stringify(loans));

  const dict = await getDictionary(session.tenantId);

  return (
    <>
      <PaymentProofPanel />
      <BorrowerDashboardClient
        loans={serializedLoans}
        initialLoanId={session.loanId}
        paymentSettings={paymentSettings}
        dict={dict}
      />
      {chitMemberships.length > 0 && <ChitOnlyPanel memberships={chitMemberships} />}
    </>
  );
}

