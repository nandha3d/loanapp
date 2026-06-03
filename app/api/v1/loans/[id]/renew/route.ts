import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { getSetting } from '@/lib/tenant';
import { calculateEndDate, calculateInstalmentDates } from '@/lib/utils';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (ctx.role === 'agent') {
    return fail('Unauthorized', 403);
  }

  const { id } = await params;

  const oldLoan = await prisma.loan.findFirst({
    where: {
      id,
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      ...scopedBranchWhere(ctx),
    },
  });

  if (!oldLoan) {
    return fail('Loan not found', 404);
  }

  if (oldLoan.status === 'settled') {
    return fail('Settled loans cannot be renewed', 400);
  }

  const prefix = await getSetting(ctx.tenantId, 'loan_code_prefix', 'LN');

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Close the old loan
      await tx.loan.update({
        where: { id },
        data: { status: 'closed', closedAt: new Date() },
      });

      // 2. Generate new loan code
      const counterSetting = await tx.appSetting.findUnique({
        where: {
          tenantId_key: { tenantId: ctx.tenantId, key: 'loan_code_counter' },
        },
      });
      const counterStr = counterSetting ? counterSetting.value : '0';
      const counter = parseInt(counterStr) + 1;
      const loanCode = `${prefix}${String(counter).padStart(4, '0')}`;

      await tx.appSetting.upsert({
        where: {
          tenantId_key: { tenantId: ctx.tenantId, key: 'loan_code_counter' },
        },
        create: {
          tenantId: ctx.tenantId,
          key: 'loan_code_counter',
          value: counter.toString(),
          group: 'system',
        },
        update: { value: counter.toString() },
      });

      // 3. Build new instalment schedule starting today
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = calculateEndDate(startDate, oldLoan.frequency, oldLoan.tenure);
      const instalmentDates = calculateInstalmentDates(startDate, oldLoan.frequency, oldLoan.tenure);
      const perInstalment = Number(oldLoan.perInstalment);

      // 4. Create new loan
      const newLoan = await tx.loan.create({
        data: {
          tenantId: ctx.tenantId,
          branchId: oldLoan.branchId,
          loanCode,
          customerId: oldLoan.customerId,
          packageId: oldLoan.packageId,
          loanType: oldLoan.loanType,
          appType: oldLoan.appType,
          collateralDetails: oldLoan.collateralDetails,
          guarantorId: oldLoan.guarantorId,
          principal: oldLoan.principal,
          deduction: oldLoan.deduction,
          deductionType: oldLoan.deductionType,
          disbursed: oldLoan.disbursed,
          frequency: oldLoan.frequency,
          tenure: oldLoan.tenure,
          startDate,
          endDate,
          perInstalment: oldLoan.perInstalment,
          penaltyRate: oldLoan.penaltyRate,
          voucherRef: `RENEWAL_OF_${oldLoan.loanCode}`,
          status: 'active',
          totalInstalments: oldLoan.tenure,
          createdById: ctx.userId,
          instalments: {
            create: instalmentDates.map((date, index) => ({
              instalmentNo: index + 1,
              dueDate: date,
              dueAmount: perInstalment,
              status: 'upcoming' as const,
            })),
          },
        },
      });

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: 'create',
          entityType: 'loan',
          entityId: newLoan.id,
          oldValue: JSON.stringify({
            renewedFrom: id,
            oldLoanCode: oldLoan.loanCode,
          }),
          newValue: JSON.stringify({ loanCode, action: 'renewal' }),
        },
      });

      return newLoan;
    });

    return ok({ success: true, newLoanId: result.id, loanCode: result.loanCode });
  } catch (error: any) {
    console.error('Error renewing loan:', error);
    return fail(error.message || 'Failed to renew loan', 500);
  }
}
