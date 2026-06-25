import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { encryptAadharNumber } from '@/lib/pii';
import { submitCollectionEntry } from '@/app/(dashboard)/[module]/collection/actions';
import { calculateLoanPreview } from '@/lib/loanCalculator';
import { calculateEndDate } from '@/lib/utils';
import { hasFinancialActivity } from '@/lib/repayments';
import { disburseFromAgent, disburseFromBranch } from '@/lib/wallet';

const CUSTOMER_EDIT_ALLOW_LIST = new Set([
  'name', 'phone', 'address', 'aadharNumber', 'kycStatus', 'photo',
]);

const LOAN_EDIT_ALLOW_LIST = new Set([
  'principal', 'deductionType', 'deduction', 'frequency', 'tenure', 
  'startDate', 'penaltyRate', 'voucherRef', 'loanType', 'collateralDetails',
  'guarantorName', 'guarantorPhone', 'guarantorAadhar', 'guarantorAddress', 'guarantorRelation'
]);

const COLLECTION_EDIT_ALLOW_LIST = new Set([
  'requestedAmount'
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const note = body.note ? String(body.note) : null;

    // A. Check if this is a general approval request
    const request = await prisma.approvalRequest.findFirst({
      where: { id, tenantId: ctx.tenantId, appType: ctx.appType, status: 'pending' },
    });

    if (request) {
      const result = await prisma.$transaction(async (tx) => {
        await tx.approvalRequest.update({
          where: { id: request.id },
          data: {
            status: 'approved',
            reviewedById: ctx.userId,
            reviewedAt: new Date(),
            reviewNotes: note,
          },
        });

        if (request.requestType === 'customer_edit' && request.entityType === 'customer') {
          const rawChanges = JSON.parse(request.requestedChanges);
          const safeChanges: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(rawChanges)) {
            if (CUSTOMER_EDIT_ALLOW_LIST.has(key)) {
              safeChanges[key] = key === 'aadharNumber'
                ? encryptAadharNumber(String(value || ''))
                : value;
            }
          }
          await tx.customer.update({
            where: { id: request.entityId },
            data: safeChanges,
          });
        } else if (request.requestType === 'edit_collection') {
          const rawChanges = JSON.parse(request.requestedChanges);
          const requestedAmount = rawChanges.requestedAmount;
          const fd = new FormData();
          fd.set('instalmentId', request.entityId);
          fd.set('receivedAmount', String(requestedAmount));
          await submitCollectionEntry(fd);
        } else if (request.requestType === 'loan_edit' && request.entityType === 'loan') {
          const loan = await tx.loan.findFirst({
            where: { id: request.entityId, tenantId: ctx.tenantId },
            include: { guarantor: true },
          });
          if (!loan) throw new Error('Target loan not found');

          const changes = JSON.parse(request.requestedChanges);
          const principal = changes.principal !== undefined ? Number(changes.principal) : Number(loan.principal);
          const interestType = changes.deductionType !== undefined ? changes.deductionType : loan.deductionType;
          const rate = changes.deduction !== undefined ? Number(changes.deduction) : Number(loan.deduction);
          const frequency = changes.frequency !== undefined ? changes.frequency : loan.frequency;
          const tenure = changes.tenure !== undefined ? Number(changes.tenure) : Number(loan.tenure);
          const startDateStr = changes.startDate !== undefined ? changes.startDate : new Date(loan.startDate).toISOString().slice(0, 10);
          const penaltyRate = changes.penaltyRate !== undefined ? Number(changes.penaltyRate) : Number(loan.penaltyRate);
          const voucherRef = changes.voucherRef !== undefined ? changes.voucherRef : loan.voucherRef;
          const loanType = changes.loanType !== undefined ? changes.loanType : loan.loanType;
          const collateralDetails = changes.collateralDetails !== undefined ? changes.collateralDetails : loan.collateralDetails;

          const startDate = new Date(startDateStr);
          const endDate = calculateEndDate(startDate, frequency, tenure);
          const calculation = calculateLoanPreview({
            principal,
            interestType,
            interestRate: rate,
            tenure,
            frequency,
            startDate,
          });
          const disbursed = calculation.disbursedAmount;
          const totalPayable = calculation.totalPayable;
          const perInstalment = calculation.perInstalment;
          const deduction = calculation.deduction;

          let currentGuarantorId = loan.guarantorId;
          const guarantorName = changes.guarantorName !== undefined ? changes.guarantorName : loan.guarantor?.name;
          const guarantorPhone = changes.guarantorPhone !== undefined ? changes.guarantorPhone : loan.guarantor?.phone;
          const guarantorAadhar = changes.guarantorAadhar !== undefined ? changes.guarantorAadhar : loan.guarantor?.aadharNumber;
          const guarantorAddress = changes.guarantorAddress !== undefined ? changes.guarantorAddress : loan.guarantor?.address;
          const guarantorRelation = changes.guarantorRelation !== undefined ? changes.guarantorRelation : loan.guarantor?.relation;

          if (guarantorName || guarantorPhone || guarantorAadhar) {
            if (currentGuarantorId) {
              await tx.guarantor.update({
                where: { id: currentGuarantorId },
                data: {
                  name: guarantorName || '',
                  phone: guarantorPhone || '',
                  aadharNumber: guarantorAadhar || null,
                  address: guarantorAddress || null,
                  relation: guarantorRelation || null
                }
              });
            } else {
              const newG = await tx.guarantor.create({
                data: {
                  customerId: loan.customerId,
                  name: guarantorName || '',
                  phone: guarantorPhone || '',
                  aadharNumber: guarantorAadhar || null,
                  address: guarantorAddress || null,
                  relation: guarantorRelation || null
                }
              });
              currentGuarantorId = newG.id;
            }
          }

          const coreChanged = 
            Number(loan.principal) !== principal ||
            Number(loan.tenure) !== tenure ||
            loan.frequency !== frequency ||
            new Date(loan.startDate).getTime() !== startDate.getTime();

          await tx.loan.update({
            where: { id: loan.id },
            data: {
              principal,
              deduction,
              deductionType: interestType,
              disbursed,
              frequency,
              tenure,
              startDate,
              endDate,
              perInstalment,
              penaltyRate,
              voucherRef,
              loanType,
              collateralDetails,
              totalPayable,
              guarantorId: currentGuarantorId,
              totalInstalments: tenure
            }
          });

          if (coreChanged) {
            if (await hasFinancialActivity(loan.id)) {
              throw new Error('Instalment schedule cannot be regenerated: loan has recorded repayments.');
            }
            await tx.instalment.deleteMany({ where: { loanId: loan.id } });
            const instalments = calculation.schedule.map((item) => ({
              loanId: loan.id,
              instalmentNo: item.instalmentNo,
              dueDate: item.dueDate,
              dueAmount: item.dueAmount,
              status: 'upcoming' as const,
            }));
            await tx.instalment.createMany({ data: instalments });
            await tx.loan.update({
              where: { id: loan.id },
              data: { paidCount: 0 },
            });
          }
        } else if (request.requestType === 'cash_handover') {
          await tx.dailyCollection.update({
            where: { id: request.entityId },
            data: {
              status: 'settled',
              lockedAt: new Date(),
            },
          });
        }
      });

      await prisma.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: 'approve',
          entityType: request.entityType,
          entityId: request.entityId,
          newValue: JSON.stringify({ requestId: id, note }),
        },
      });

      return ok({ status: 'approved' });
    }

    // B. Check if this is a pending customer creation
    const customer = await prisma.customer.findFirst({
      where: { id, tenantId: ctx.tenantId, appType: ctx.appType, status: 'pending_review' },
    });

    if (customer) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { status: 'active' },
      });

      await prisma.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: 'approve',
          entityType: 'customer',
          entityId: id,
          newValue: JSON.stringify({ action: 'approve_creation', status: 'active', note }),
        },
      });

      // Send system notification
      if (customer.agentId) {
        await prisma.systemNotification.create({
          data: {
            tenantId: ctx.tenantId,
            branchId: customer.branchId,
            appType: ctx.appType,
            targetUserId: customer.agentId,
            targetRole: 'agent',
            type: 'customer_approved',
            icon: 'check_circle',
            title: 'Customer approved',
            message: `Your customer ${customer.name} has been approved and is now active.`,
            link: '/customers',
          },
        }).catch(() => {});
      }

      return ok({ status: 'approved' });
    }

    // C. Check if this is a pending loan request
    const loan = await prisma.loan.findFirst({
      where: { id, tenantId: ctx.tenantId, appType: ctx.appType, status: 'pending_review' },
    });

    if (loan) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.loan.update({
            where: { id },
            data: { status: 'active' },
          });

          let isAgent = false;
          if (loan.createdById) {
            const creator = await tx.user.findUnique({
              where: { id: loan.createdById },
              select: { role: true },
            });
            isAgent = creator?.role === 'agent';
          }

          const disburseAmt = Number(loan.disbursed);
          if (isAgent && loan.createdById) {
            await disburseFromAgent(tx, {
              tenantId: ctx.tenantId,
              appType: ctx.appType,
              agentId: loan.createdById,
              amount: disburseAmt,
              loanId: loan.id,
              byUserId: ctx.userId,
            });
          } else if (loan.branchId) {
            await disburseFromBranch(tx, {
              tenantId: ctx.tenantId,
              appType: ctx.appType,
              branchId: loan.branchId,
              amount: disburseAmt,
              loanId: loan.id,
              byUserId: ctx.userId,
            });
          }
        });

        await prisma.auditLog.create({
          data: {
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            action: 'approve',
            entityType: 'loan',
            entityId: id,
            newValue: JSON.stringify({ action: 'approve_creation', status: 'active', note }),
          },
        });

        if (loan.createdById) {
          await prisma.systemNotification.create({
            data: {
              tenantId: ctx.tenantId,
              branchId: loan.branchId,
              appType: ctx.appType,
              targetUserId: loan.createdById,
              targetRole: 'agent',
              type: 'loan_approved',
              icon: 'check_circle',
              title: 'Loan approved',
              message: `Loan ${loan.loanCode} has been approved.`,
              link: '/loans',
            },
          }).catch(() => {});
        }

        return ok({ status: 'approved' });
      } catch (err: any) {
        if (err.name === 'InsufficientFloatError') {
          return fail(`Agent has insufficient float to disburse ₹${err.required}. Please release funds first.`, 400);
        }
        throw err;
      }
    }

    return fail('Approval target not found or already processed', 404);
  } catch (e: any) {
    return fail(e?.message ?? 'Review failed', 500);
  }
}
