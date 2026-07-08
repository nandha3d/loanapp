import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireBorrowerMobileContext } from '@/lib/api/borrower-mobile';

function money(value: unknown) {
  return Number(value ?? 0);
}

export async function GET(req: NextRequest) {
  const borrower = await requireBorrowerMobileContext(req);
  if (!borrower) return fail('Unauthorized', 401);

  try {
    const loans = await prisma.loan.findMany({
      where: {
        customerId: borrower.customerId,
        tenantId: borrower.tenantId,
        deletedAt: null,
      },
      include: {
        customer: {
          include: {
            route: { select: { name: true } },
            collectionPoints: { where: { isPrimary: true }, take: 1 },
          },
        },
        instalments: {
          orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return ok(
      loans.map((loan) => ({
        id: loan.id,
        loanCode: loan.loanCode,
        status: loan.status,
        principalAmount: money(loan.principal),
        totalPayable: money(loan.totalPayable),
        interestRate: money(loan.deduction),
        tenure: loan.tenure,
        frequency: loan.frequency,
        disbursedAt: loan.startDate,
        customerName: loan.customer.name,
        collectionPoint:
          loan.customer.collectionPoints[0]?.name ??
          loan.customer.route?.name ??
          null,
        instalments: loan.instalments.map((inst) => ({
          id: inst.id,
          instNo: inst.instalmentNo,
          dueDate: inst.dueDate,
          dueAmount: money(inst.dueAmount),
          receivedAmount: money(inst.receivedAmount),
          status: inst.status,
          paidAt: inst.receivedAt,
        })),
      })),
    );
  } catch (e: any) {
    return fail(e?.message ?? 'Borrower loans failed', 500);
  }
}
