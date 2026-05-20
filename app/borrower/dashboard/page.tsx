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

  return <BorrowerDashboardClient loans={loans} initialLoanId={session.loanId} />;
}

