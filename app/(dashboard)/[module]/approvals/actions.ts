'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { decryptAadharNumber, encryptAadharNumber, isMaskedAadharNumber } from '@/lib/pii';
import { submitCollectionEntry } from '@/app/(dashboard)/[module]/collection/actions';
import { calculateLoanPreview } from '@/lib/loanCalculator';
import { notifyUser } from '@/lib/notify/userNotify';
import { modulePath } from '@/types/modules';
import { getActiveBranchId } from '@/lib/branch';

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

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Atomically claim the request by updating status to approved/rejected
      const updateResult = await tx.approvalRequest.updateMany({
        where: { id: requestId, tenantId, appType, status: 'pending' },
        data: {
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewedById: userId,
          reviewedAt: new Date(),
          reviewNotes,
        },
      });

      if (updateResult.count === 0) {
        throw new Error('Request not found or already processed');
      }

      // 2. Fetch the request details to perform side-effects
      const request = await tx.approvalRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        throw new Error('Request not found');
      }

      if (action === 'approve') {
        if (request.requestType === 'customer_edit' && request.entityType === 'customer') {
          // Verify the target customer belongs to this tenant+appType
          const customer = await tx.customer.findFirst({
            where: { id: request.entityId, tenantId, appType },
            select: { id: true },
          });
          if (!customer) {
            throw new Error('Target customer not found in this tenant/app');
          }

          const staleApprovedRequest = await tx.approvalRequest.findFirst({
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
            await tx.approvalRequest.update({
              where: { id: request.id },
              data: {
                status: 'rejected',
                reviewNotes: reviewNotes || 'Rejected as stale: another queued edit was already approved.',
              },
            });
            return { isStale: true };
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
            where: { id: request.entityId, tenantId },
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
            where: { id: request.entityId, tenantId, appType },
            include: { guarantor: true }
          });
          if (!loan) {
            throw new Error('Target loan not found in this tenant/app');
          }

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
          tenantId,
          userId,
          action: action === 'approve' ? 'approve' : 'reject',
          entityType: request.entityType,
          entityId: request.entityId,
          newValue: JSON.stringify({ requestId, action, reviewNotes }),
        },
      });

      return { success: true as const, requestedById: request.requestedById, requestType: request.requestType };
    });

    if ((result as any)?.isStale) {
      revalidatePath('/approvals');
      return { success: false, error: 'This customer edit request is stale after another queued edit was approved.' };
    }

    // Notify the agent that their request was reviewed
    if ((result as any)?.requestedById) {
      const label = action === 'approve' ? 'approved' : 'rejected';
      const requestLabel = ((result as any).requestType as string).replace(/_/g, ' ');
      await notifyUser({
        tenantId,
        appType,
        targetUserId: (result as any).requestedById,
        targetRole: 'agent',
        type: `request_${label}`,
        icon: action === 'approve' ? 'check_circle' : 'cancel',
        title: `Request ${label}`,
        message: `Your ${requestLabel} request has been ${label}.${reviewNotes ? ` Note: ${reviewNotes}` : ''}`,
        link: modulePath(appType, '/approvals'),
      });
    }

    revalidatePath('/approvals');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Transaction failed' };
  }
}

export async function approveCustomerCreation(customerId: string) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const userId = session?.user?.id;
  const userRole = (session?.user as any)?.role;
  if (userRole === 'agent') return { success: false, error: 'Unauthorized' };

  // Verify customer belongs to this tenant
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
    select: { id: true, name: true, agentId: true, branchId: true },
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

  // Notify the agent that their customer creation was approved
  if (customer.agentId) {
    await notifyUser({
      tenantId,
      branchId: customer.branchId,
      appType,
      targetUserId: customer.agentId,
      targetRole: 'agent',
      type: 'customer_approved',
      icon: 'check_circle',
      title: 'Customer approved',
      message: `Your customer ${customer.name} has been approved and is now active.`,
      link: modulePath(appType, '/customers'),
    });
  }

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
  const agentBranchId = await getActiveBranchId();

  if (!userId) return { success: false, error: 'Not authenticated' };

  const customerId = formData.get('customerId') as string;
  const reason = formData.get('reason') as string;

  if (!customerId || !reason?.trim()) {
    return { success: false, error: 'Customer and reason are required' };
  }

  // Verify customer belongs to this tenant
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, appType },
    select: { id: true, name: true, phone: true, address: true, aadharNumber: true, kycStatus: true, branchId: true },
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

  // Notify everyone who can review (branch admins + tenant superadmins) so the
  // request never lands only on one inbox. Both branches are passed, not one
  // collapsed value: the customer takes its ROUTE's branch, which need not be
  // the filing agent's, and NOTIF-6 wants the admins of both told.
  const { notifyApprovers } = await import('@/lib/notify/approvers');
  await notifyApprovers({
    tenantId,
    branchId: customer.branchId,
    requesterBranchId: agentBranchId,
    appType,
    type: 'customer_edit_review',
    icon: 'rate_review',
    title: 'Customer edit pending review',
    message: `Agent requested edits for customer ${customer.name}.`,
    link: modulePath(appType, '/approvals'),
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
  const appType = await getUserAppType();
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
    select: { id: true, loanCode: true, branchId: true, createdById: true, disbursed: true, startDate: true },
  });

  if (!loan) {
    return { success: false, error: 'Loan not found or already processed' };
  }

  try {
    const newStatus = action === 'approve' ? 'active' : 'rejected';
    await prisma.$transaction(async (tx) => {
      await tx.loan.update({
        where: { id: loanId },
        data: { status: newStatus },
      });
      if (action === 'approve') {
        const { disburseFromAgent, disburseFromBranch } = await import('@/lib/wallet');
        let isAgent = false;
        let autoRelease = true;
        
        if (loan.createdById) {
          const creator = await tx.user.findUnique({
            where: { id: loan.createdById },
            select: { role: true, autoReleaseFloat: true },
          });
          isAgent = creator?.role === 'agent';
          // autoReleaseFloat is an AGENT-only toggle. Non-agent creators always
          // auto-release (original privilege) so admin-created loans aren't
          // accidentally blocked by the agent permission default.
          autoRelease = isAgent ? creator!.autoReleaseFloat !== false : true;
        }

        // An agent's float ALWAYS drops by the net disbursed when their loan is
        // approved (the cash was handed to the customer); not gated by
        // autoReleaseFloat. Admin/branch loans honour autoRelease (always true).
        const shouldDisburse = isAgent ? true : autoRelease;
        if (shouldDisburse) {
          const disburseAmt = Number(loan.disbursed);
          if (isAgent && loan.createdById) {
            await disburseFromAgent(tx, {
              tenantId,
              appType,
              agentId: loan.createdById,
              amount: disburseAmt,
              loanId: loan.id,
              byUserId: userId,
            });
          } else if (loan.branchId) {
            await disburseFromBranch(tx, {
              tenantId,
              appType,
              branchId: loan.branchId,
              amount: disburseAmt,
              loanId: loan.id,
              byUserId: userId,
            });
          }
          // Record the cash leaving the books (drives the capital balance). At
          // creation this is posted only for already-active loans, so approved
          // loans need it here too.
          await tx.accountEntry.create({
            data: {
              tenantId,
              appType,
              branchId: loan.branchId || undefined,
              entryDate: loan.startDate || new Date(),
              type: 'loan_disburse',
              category: 'cash',
              amount: disburseAmt,
              description: `Loan ${loan.loanCode} disbursed to customer`,
              referenceId: loan.id,
              referenceType: 'loan',
              createdBy: loan.createdById || userId,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: action === 'approve' ? 'approve' : 'reject',
          entityType: 'loan',
          entityId: loanId,
          newValue: JSON.stringify({ action, reviewNotes, newStatus }),
        },
      });
    });
  } catch (err: any) {
    if (err.name === 'InsufficientFloatError') {
      return { success: false, error: `Agent has insufficient float to disburse ₹${err.required}. Please release funds first.` };
    }
    return { success: false, error: err.message || 'Approval transaction failed' };
  }

  revalidatePath('/approvals');
  revalidatePath('/loans');

  // Notify the agent that their loan was reviewed
  if (loan.createdById) {
    const label = action === 'approve' ? 'approved' : 'rejected';
    await prisma.systemNotification.create({
      data: {
        tenantId,
        branchId: loan.branchId,
        appType,
        targetUserId: loan.createdById,
        targetRole: 'agent',
        type: `loan_${label}`,
        icon: action === 'approve' ? 'check_circle' : 'cancel',
        title: `Loan ${label}`,
        message: `Loan ${loan.loanCode} has been ${label}.${reviewNotes ? ` Note: ${reviewNotes}` : ''}`,
        link: modulePath(appType, '/loans'),
      },
    }).catch(() => {});
  }

  return { success: true };
}

export async function rejectCustomerCreation(customerId: string, reviewNotes?: string) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const userId = session?.user?.id;
  const userRole = (session?.user as any)?.role;
  if (userRole === 'agent') return { success: false, error: 'Unauthorized' };

  // Verify customer belongs to this tenant
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, status: 'pending_review' },
    select: { id: true, name: true, agentId: true, branchId: true },
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

  // Notify the agent that their customer creation was rejected
  if (customer.agentId) {
    await prisma.systemNotification.create({
      data: {
        tenantId,
        branchId: customer.branchId,
        appType,
        targetUserId: customer.agentId,
        targetRole: 'agent',
        type: 'customer_rejected',
        icon: 'cancel',
        title: 'Customer rejected',
        message: `Your customer ${customer.name} was not approved.${reviewNotes ? ` Note: ${reviewNotes}` : ''}`,
        link: modulePath(appType, '/customers'),
      },
    }).catch(() => {});
  }

  revalidatePath('/customers');
  revalidatePath('/dashboard');
  revalidatePath('/approvals');
  return { success: true };
}

export async function approveVehicleCreation(vehicleId: string) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const userId = session?.user?.id;
  const userRole = (session?.user as any)?.role;
  if (userRole === 'agent') return { success: false, error: 'Unauthorized' };

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId, status: 'pending_review' },
    select: {
      id: true,
      registrationNo: true,
      customer: { select: { agentId: true, branchId: true, name: true } },
    },
  });
  if (!vehicle) return { success: false, error: 'Vehicle not found or not in pending review' };

  await prisma.vehicle.update({ where: { id: vehicleId }, data: { status: 'active' } });

  await prisma.auditLog.create({
    data: {
      tenantId: tenantId!,
      userId,
      action: 'approve',
      entityType: 'vehicle',
      entityId: vehicleId,
      newValue: JSON.stringify({ action: 'approve_creation', status: 'active' }),
    },
  });

  // Notify the filing agent (the vehicle's customer's agent).
  if (vehicle.customer?.agentId) {
    await notifyUser({
      tenantId,
      branchId: vehicle.customer.branchId,
      appType,
      targetUserId: vehicle.customer.agentId,
      targetRole: 'agent',
      type: 'vehicle_approved',
      icon: 'check_circle',
      title: 'Vehicle approved',
      message: `Vehicle ${vehicle.registrationNo} has been approved and is now active.`,
      link: modulePath(appType, '/vehicles'),
    });
  }

  revalidatePath('/vehicles');
  revalidatePath('/approvals');
  return { success: true };
}

export async function rejectVehicleCreation(vehicleId: string, reviewNotes?: string) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const userId = session?.user?.id;
  const userRole = (session?.user as any)?.role;
  if (userRole === 'agent') return { success: false, error: 'Unauthorized' };

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId, status: 'pending_review' },
    select: {
      id: true,
      registrationNo: true,
      customer: { select: { agentId: true, branchId: true, name: true } },
    },
  });
  if (!vehicle) return { success: false, error: 'Vehicle not found or not in pending review' };

  await prisma.vehicle.update({ where: { id: vehicleId }, data: { status: 'inactive' } });

  await prisma.auditLog.create({
    data: {
      tenantId: tenantId!,
      userId,
      action: 'reject',
      entityType: 'vehicle',
      entityId: vehicleId,
      newValue: JSON.stringify({ action: 'reject_creation', status: 'inactive', reviewNotes }),
    },
  });

  if (vehicle.customer?.agentId) {
    await notifyUser({
      tenantId,
      branchId: vehicle.customer.branchId,
      appType,
      targetUserId: vehicle.customer.agentId,
      targetRole: 'agent',
      type: 'vehicle_rejected',
      icon: 'cancel',
      title: 'Vehicle rejected',
      message: `Vehicle ${vehicle.registrationNo} was not approved.${reviewNotes ? ` Note: ${reviewNotes}` : ''}`,
      link: modulePath(appType, '/vehicles'),
    });
  }

  revalidatePath('/vehicles');
  revalidatePath('/approvals');
  return { success: true };
}
