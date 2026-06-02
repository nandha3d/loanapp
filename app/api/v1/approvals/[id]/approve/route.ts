import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { encryptAadharNumber } from '@/lib/pii';
import { submitCollectionEntry } from '@/app/(dashboard)/[module]/collection/actions';
import { calculateLoanPreview } from '@/lib/loanCalculator';
import { calculateEndDate } from '@/lib/utils';
import { hasFinancialActivity } from '@/lib/repayments';

// Fields an agent is allowed to request changes to on a customer record
const CUSTOMER_EDIT_ALLOW_LIST = new Set([
  'name', 'phone', 'address', 'aadharNumber', 'kycStatus', 'photo',
]);

// Fields allowed for loan edit requests
const LOAN_EDIT_ALLOW_LIST = new Set([
  'principal', 'deductionType', 'deduction', 'frequency', 'tenure', 
  'startDate', 'penaltyRate', 'voucherRef', 'loanType', 'collateralDetails',
  'guarantorName', 'guarantorPhone', 'guarantorAadhar', 'guarantorAddress', 'guarantorRelation'
]);

// Fields allowed for collection edit requests
const COLLECTION_EDIT_ALLOW_LIST = new Set([
  'requestedAmount'
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return resolve(req, params, 'approved');
}

async function resolve(
  req: NextRequest,
  params: Promise<{ id: string }>,
  decision: 'approved' | 'rejected',
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

    const result = await prisma.$transaction(async (tx) => {
      // 1. Atomically claim the request by updating status to approved/rejected
      const updateResult = await tx.approvalRequest.updateMany({
        where: { id, tenantId: ctx.tenantId, appType: ctx.appType, status: 'pending' },
        data: {
          status: decision,
          reviewedById: ctx.userId,
          reviewedAt: new Date(),
          reviewNotes: note,
        },
      });

      if (updateResult.count === 0) {
        throw new Error('Approval not found or already processed');
      }

      // 2. Fetch the request details to perform side-effects
      const request = await tx.approvalRequest.findUnique({
        where: { id },
      });

      if (!request) {
        throw new Error('Approval not found');
      }

      if (decision === 'approved') {
        if (request.requestType === 'customer_edit' && request.entityType === 'customer') {
          // Verify the target customer belongs to this tenant+appType
          const customer = await tx.customer.findFirst({
            where: { id: request.entityId, tenantId: ctx.tenantId, appType: ctx.appType },
            select: { id: true },
          });
          if (!customer) throw new Error('Target customer not found in this tenant/app');

          const staleApprovedRequest = await tx.approvalRequest.findFirst({
            where: {
              tenantId: ctx.tenantId,
              appType: ctx.appType,
              requestType: 'customer_edit',
              entityType: 'customer',
              entityId: request.entityId,
              status: 'approved',
              reviewedAt: { gt: request.createdAt },
            },
            select: { id: true },
          });
          if (staleApprovedRequest) {
            await tx.approvalRequest.update({
              where: { id: request.id },
              data: {
                status: 'rejected',
                reviewNotes: note || 'Rejected as stale: another queued edit was already approved.',
              },
            });
            throw new Error('This customer edit request is stale after another queued edit was approved.');
          }

          // Apply only allow-listed fields
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
            where: { id: request.entityId, tenantId: ctx.tenantId },
            data: safeChanges,
          });
        } else if (request.requestType === 'edit_collection') {
          const rawChanges = JSON.parse(request.requestedChanges);
          const requestedAmount = COLLECTION_EDIT_ALLOW_LIST.has('requestedAmount') 
            ? rawChanges.requestedAmount 
            : undefined;
          
          if (requestedAmount === undefined) {
            throw new Error('Invalid collection edit request: missing requestedAmount');
          }
          
          const fd = new FormData();
          fd.set('instalmentId', request.entityId);
          fd.set('receivedAmount', String(requestedAmount));
          await submitCollectionEntry(fd);
        } else if (request.requestType === 'loan_edit' && request.entityType === 'loan') {
          // Verify target loan belongs to this tenant+appType
          const loan = await tx.loan.findFirst({
            where: { id: request.entityId, tenantId: ctx.tenantId, appType: ctx.appType },
            include: { guarantor: true }
          });
          if (!loan) throw new Error('Target loan not found in this tenant/app');

          const rawChanges = JSON.parse(request.requestedChanges);
          
          // Validate only allow-listed fields are present
          for (const key of Object.keys(rawChanges)) {
            if (!LOAN_EDIT_ALLOW_LIST.has(key)) {
              throw new Error(`Unauthorized field in loan edit request: ${key}`);
            }
          }

          const changes = rawChanges;

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
      }

      await tx.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: decision,
          entityType: 'approval',
          entityId: id,
          newValue: JSON.stringify({ note }),
        },
      });

      return { request };
    });

    return ok(result.request);
  } catch (e: any) {
    return fail(e?.message ?? 'Review failed', 500);
  }
}

export { resolve as _resolve };
