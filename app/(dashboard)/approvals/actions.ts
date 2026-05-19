'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { decryptAadharNumber, encryptAadharNumber, isMaskedAadharNumber } from '@/lib/pii';
import { submitCollectionEntry } from '@/app/(dashboard)/collection/actions';
import { calculateLoanPreview } from '@/lib/loanCalculator';

// Fields an agent is allowed to request changes to on a customer record
const CUSTOMER_EDIT_ALLOW_LIST = new Set([
  'name', 'phone', 'address', 'aadharNumber', 'kycStatus', 'photo',
]);

export async function reviewRequest(formData: FormData) {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const userId = session?.user?.id;

  if (!userId || userRole === 'agent') {
    return { success: false, error: 'Unauthorized' };
  }

  const requestId = formData.get('requestId') as string;
  const action = formData.get('action') as string; // 'approve' or 'reject'
  const reviewNotes = formData.get('reviewNotes') as string;

  const request = await prisma.approvalRequest.findUnique({
    where: { id: requestId, tenantId, appType },
  });

  if (!request || request.status !== 'pending') {
    return { success: false, error: 'Request not found or already processed' };
  }

  if (action === 'approve') {
    if (request.requestType === 'customer_edit' && request.entityType === 'customer') {
      // Verify the target customer belongs to this tenant+appType
      const customer = await prisma.customer.findFirst({
        where: { id: request.entityId, tenantId, appType },
        select: { id: true },
      });
      if (!customer) {
        return { success: false, error: 'Target customer not found in this tenant/app' };
      }

      const staleApprovedRequest = await prisma.approvalRequest.findFirst({
        where: {
          tenantId,
          appType,
          requestType: 'customer_edit',
          entityType: 'customer',
          entityId: request.entityId,
          status: 'approved',
          reviewedAt: { gt: request.createdAt },
        },
        select: { id: true },
      });
      if (staleApprovedRequest) {
        await prisma.approvalRequest.update({
          where: { id: request.id },
          data: {
            status: 'rejected',
            reviewedById: userId,
            reviewedAt: new Date(),
            reviewNotes: reviewNotes || 'Rejected as stale: another queued edit was already approved.',
          },
        });
        return { success: false, error: 'This customer edit request is stale after another queued edit was approved.' };
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

      await prisma.customer.update({
        where: { id: request.entityId, tenantId },
        data: safeChanges,
      });
    } else if (request.requestType === 'edit_collection') {
      const { requestedAmount } = JSON.parse(request.requestedChanges);
      const fd = new FormData();
      fd.set('instalmentId', request.entityId);
      fd.set('receivedAmount', String(requestedAmount));
      await submitCollectionEntry(fd);
    } else if (request.requestType === 'loan_edit' && request.entityType === 'loan') {
      // Verify target loan belongs to this tenant+appType
      const loan = await prisma.loan.findFirst({
        where: { id: request.entityId, tenantId, appType },
        include: { guarantor: true }
      });
      if (!loan) {
        return { success: false, error: 'Target loan not found in this tenant/app' };
      }

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
      const { calculateEndDate } = await import('@/lib/utils');
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

      try {
        await prisma.$transaction(async (tx) => {
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
            const { hasFinancialActivity } = await import('@/lib/repayments');
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
        });
      } catch (err: any) {
        return { success: false, error: err.message || 'Transaction failed' };
      }
    } else if (request.requestType === 'cash_handover') {
      await prisma.dailyCollection.update({
        where: { id: request.entityId },
        data: {
          status: 'settled',
          lockedAt: new Date(),
        },
      });
    }
  }

  await prisma.approvalRequest.update({
    where: { id: requestId },
    data: {
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedById: userId,
      reviewedAt: new Date(),
      reviewNotes,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: action === 'approve' ? 'approve' : 'reject',
      entityType: request.entityType,
      entityId: request.entityId,
      newValue: JSON.stringify({ requestId, action, reviewNotes }),
    },
  });

  revalidatePath('/approvals');
  return { success: true };
}

export async function approveCustomerCreation(customerId: string) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const userId = session?.user?.id;
  const userRole = (session?.user as any)?.role;
  if (userRole === 'agent') return { success: false, error: 'Unauthorized' };

  // Verify customer belongs to this tenant
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
    select: { id: true },
  });
  if (!customer) return { success: false, error: 'Customer not found' };

  await prisma.customer.update({
    where: { id: customerId },
    data: { status: 'active' },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenantId!,
      userId,
      action: 'approve',
      entityType: 'customer',
      entityId: customerId,
      newValue: JSON.stringify({ action: 'approve_creation', status: 'active' }),
    },
  });

  revalidatePath('/customers');
  revalidatePath('/dashboard');
  return { success: true };
}

// Fields an agent is allowed to request edits for
const EDIT_REQUEST_FIELDS = ['name', 'phone', 'address', 'aadharNumber', 'kycStatus'];

/**
 * Submitted by an agent from the customer profile page.
 * Creates a pending ApprovalRequest for admin/superadmin to review.
 */
export async function submitEditRequest(formData: FormData) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const userId = session?.user?.id;
  const userRole = (session?.user as any)?.role;

  if (!userId) return { success: false, error: 'Not authenticated' };

  const customerId = formData.get('customerId') as string;
  const reason = formData.get('reason') as string;

  if (!customerId || !reason?.trim()) {
    return { success: false, error: 'Customer and reason are required' };
  }

  // Verify customer belongs to this tenant
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, appType },
    select: { id: true, name: true, phone: true, address: true, aadharNumber: true, kycStatus: true },
  });
  if (!customer) return { success: false, error: 'Customer not found' };

  // Collect only the allowed changed fields from the form
  const requestedChanges: Record<string, string> = {};
  for (const field of EDIT_REQUEST_FIELDS) {
    const val = formData.get(field) as string | null;
    if (field === 'aadharNumber' && isMaskedAadharNumber(val)) continue;
    const existingValue = field === 'aadharNumber'
      ? decryptAadharNumber(customer.aadharNumber)
      : (customer as any)[field];
    if (val !== null && val !== existingValue) {
      requestedChanges[field] = field === 'aadharNumber'
        ? encryptAadharNumber(val) || ''
        : val;
    }
  }

  if (Object.keys(requestedChanges).length === 0) {
    return { success: false, error: 'No changes detected. Please modify at least one field.' };
  }

  await prisma.approvalRequest.create({
    data: {
      tenantId,
      appType,
      requestType: 'customer_edit',
      entityType: 'customer',
      entityId: customerId,
      requestedById: userId,
      requestedChanges: JSON.stringify(requestedChanges),
      reason,
      status: 'pending',
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'create',
      entityType: 'approval_request',
      entityId: customerId,
      newValue: JSON.stringify({ requestType: 'customer_edit', changes: requestedChanges }),
    },
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath('/approvals');
  return { success: true };
}

/**
 * Review a pending loan created by an agent.
 * Admin/Superadmin/Developer can approve or reject.
 */
export async function reviewPendingLoan(formData: FormData) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const userId = session?.user?.id;
  const userRole = (session?.user as any)?.role;

  if (!userId || userRole === 'agent') {
    return { success: false, error: 'Unauthorized' };
  }

  const loanId = formData.get('loanId') as string;
  const action = formData.get('action') as string; // 'approve' or 'reject'
  const reviewNotes = formData.get('reviewNotes') as string;

  if (!loanId || !['approve', 'reject'].includes(action)) {
    return { success: false, error: 'Invalid request' };
  }

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, tenantId, status: 'pending_review' },
    select: { id: true, loanCode: true },
  });

  if (!loan) {
    return { success: false, error: 'Loan not found or already processed' };
  }

  const newStatus = action === 'approve' ? 'active' : 'rejected';

  await prisma.loan.update({
    where: { id: loanId },
    data: { status: newStatus },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: action === 'approve' ? 'approve' : 'reject',
      entityType: 'loan',
      entityId: loanId,
      newValue: JSON.stringify({ action, reviewNotes, newStatus }),
    },
  });

  revalidatePath('/approvals');
  revalidatePath('/loans');
  return { success: true };
}

export async function rejectCustomerCreation(customerId: string, reviewNotes?: string) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const userId = session?.user?.id;
  const userRole = (session?.user as any)?.role;
  if (userRole === 'agent') return { success: false, error: 'Unauthorized' };

  // Verify customer belongs to this tenant
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, status: 'pending_review' },
    select: { id: true },
  });
  if (!customer) return { success: false, error: 'Customer not found or not in pending review' };

  await prisma.customer.update({
    where: { id: customerId },
    data: { status: 'inactive' }, // Or we can delete or set to rejected
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenantId!,
      userId,
      action: 'reject',
      entityType: 'customer',
      entityId: customerId,
      newValue: JSON.stringify({ action: 'reject_creation', status: 'inactive', reviewNotes }),
    },
  });

  revalidatePath('/customers');
  revalidatePath('/dashboard');
  revalidatePath('/approvals');
  return { success: true };
}
