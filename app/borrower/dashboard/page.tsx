import { getBorrowerSession } from '@/lib/borrowerAuth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import BorrowerDashboardClient from './BorrowerDashboardClient';

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

  if (loans.length === 0) {
    redirect('/borrower/login');
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

  return (
    <BorrowerDashboardClient
      loans={serializedLoans}
      initialLoanId={session.loanId}
      paymentSettings={paymentSettings}
    />
  );
}

