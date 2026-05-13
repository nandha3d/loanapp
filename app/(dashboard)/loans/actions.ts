'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { calculateEndDate, calculateInstalmentDates, formatDateISO } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { checkLimit } from '@/lib/subscription';

export async function createLoan(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const createdById = session?.user?.id;
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const userBranchId = (session?.user as any)?.branchId || null;

  // Only admin, superadmin and developer can create loans
  if (!createdById || role === 'agent') {
    redirect('/collection');
  }

  // Enforce subscription loan limit
  try {
    await checkLimit(tenantId, 'loans');
  } catch (err: any) {
    return { error: err.message as string };
  }

  const customerId = formData.get('customerId') as string;
  const principal = Number(formData.get('principal'));
  const deduction = Number(formData.get('deduction'));
  const frequency = formData.get('frequency') as string;
  const tenure = Number(formData.get('tenure'));
  const startDateStr = formData.get('startDate') as string;
  const packageId = formData.get('packageId') as string || null;
  const penaltyRate = Number(formData.get('penaltyRate'));
  const voucherRef = formData.get('voucherRef') as string;
  const loanType = formData.get('loanType') as string || 'cheque';
  const collateralDetails = formData.get('collateralDetails') as string || null;
  const guarantorName = formData.get('guarantorName') as string;
  const guarantorPhone = formData.get('guarantorPhone') as string;

  const startDate = new Date(startDateStr);
  const endDate = calculateEndDate(startDate, frequency, tenure);
  const disbursed = principal - deduction;
  const perInstalment = Math.round(principal / tenure);

  // Generate Loan Code
  const prefix = await getSetting(tenantId, 'loan_code_prefix', 'LN');
  const counterStr = await getSetting(tenantId, 'loan_code_counter', '0');
  const counter = parseInt(counterStr) + 1;
  const loanCode = `${prefix}${String(counter).padStart(4, '0')}`;
  
  await prisma.appSetting.upsert({
    where: { tenantId_key: { tenantId, key: 'loan_code_counter' } },
    update: { value: counter.toString() },
    create: { tenantId, key: 'loan_code_counter', value: counter.toString(), group: 'system' }
  });

  // Create guarantor if provided
  let guarantorId = null;
  if (guarantorName && guarantorPhone) {
    const guarantor = await prisma.guarantor.create({
      data: {
        customerId,
        name: guarantorName,
        phone: guarantorPhone,
      }
    });
    guarantorId = guarantor.id;
  }

  // Calculate Instalment Dates
  const instalmentDates = calculateInstalmentDates(startDate, frequency, tenure);
  const instalments = instalmentDates.map((date, index) => ({
    instalmentNo: index + 1,
    dueDate: date,
    dueAmount: perInstalment,
    status: 'upcoming'
  }));

  // Fetch customer's agent — validate it belongs to same tenant/app
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, appType, status: 'active' },
  });

  if (!customer) {
    return { error: 'Customer not found or inactive. Please select a valid customer.' };
  }

  // Validate createdById references a real user in the DB
  if (createdById) {
    const creatorExists = await prisma.user.findUnique({ where: { id: createdById }, select: { id: true } });
    if (!creatorExists) {
      return { error: 'Your session is stale. Please log out and log in again.' };
    }
  }

  // Validate package belongs to same tenant/app if provided
  if (packageId) {
    const pkg = await prisma.loanPackage.findFirst({
      where: { id: packageId, tenantId, appType },
    });
    if (!pkg) {
      redirect('/loans/new?error=package_not_found');
    }
  }

  // Check for duplicate voucher reference (within the same tenant)
  if (voucherRef) {
    const existingLoan = await prisma.loan.findFirst({
      where: { tenantId, voucherRef }
    });
    if (existingLoan) {
      return { error: `A loan with voucher reference "${voucherRef}" already exists.` };
    }
  }

  // Create Loan & Instalments
  const loan = await prisma.loan.create({
    data: {
      tenantId,
      branchId: customer?.branchId || userBranchId,
      loanCode,
      customerId,
      packageId,
      loanType,
      appType,
      collateralDetails,
      guarantorId,
      principal,
      deduction,
      disbursed,
      frequency,
      tenure,
      startDate,
      endDate,
      perInstalment,
      penaltyRate,
      voucherRef,
      status: 'active',
      totalInstalments: tenure,
      createdById,
      instalments: {
        create: instalments
      }
    }
  });

  // Log activity - only if userId is valid
  if (createdById) {
    try {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: createdById,
          action: 'create',
          entityType: 'loan',
          entityId: loan.id,
          newValue: JSON.stringify({ principal, tenure, loanCode })
        }
      });
    } catch (e) {
      console.error('Failed to create audit log:', e);
    }
  }

  revalidatePath('/loans');
  redirect(`/loans/${loan.id}`);
}

export async function updateLoan(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  const tenantId = await getDefaultTenantId();

  if (!userId || role === 'agent') {
    return { error: 'Unauthorized' };
  }

  const loanId = formData.get('loanId') as string;
  const principal = Number(formData.get('principal'));
  const deduction = Number(formData.get('deduction'));
  const frequency = formData.get('frequency') as string;
  const tenure = Number(formData.get('tenure'));
  const startDateStr = formData.get('startDate') as string;
  const penaltyRate = Number(formData.get('penaltyRate'));
  const voucherRef = formData.get('voucherRef') as string;
  const loanType = formData.get('loanType') as string;
  const collateralDetails = formData.get('collateralDetails') as string;
  const guarantorName = formData.get('guarantorName') as string;
  const guarantorPhone = formData.get('guarantorPhone') as string;

  const startDate = new Date(startDateStr);
  const endDate = calculateEndDate(startDate, frequency, tenure);
  const disbursed = principal - deduction;
  const perInstalment = Math.round(principal / tenure);

  // Fetch loan to ensure it exists and belongs to tenant
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, tenantId },
    include: { guarantor: true }
  });

  if (!loan) return { error: 'Loan not found' };

  // Check if core fields changed
  const coreChanged = 
    Number(loan.principal) !== principal ||
    Number(loan.tenure) !== tenure ||
    loan.frequency !== frequency ||
    formatDateISO(new Date(loan.startDate)) !== startDateStr;

  // Update or Create guarantor
  let guarantorId = loan.guarantorId;
  if (guarantorName && guarantorPhone) {
    if (loan.guarantor) {
      await prisma.guarantor.update({
        where: { id: loan.guarantorId! },
        data: { name: guarantorName, phone: guarantorPhone }
      });
    } else {
      const g = await prisma.guarantor.create({
        data: {
          customerId: loan.customerId,
          name: guarantorName,
          phone: guarantorPhone
        }
      });
      guarantorId = g.id;
    }
  }

  // Update Loan
  await prisma.loan.update({
    where: { id: loanId },
    data: {
      principal,
      deduction,
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
      guarantorId,
      totalInstalments: tenure
    }
  });

  // Regenerate schedule if core fields changed
  if (coreChanged) {
    // Delete existing instalments (Caution: This removes payment history for this loan)
    await prisma.loanInstalment.deleteMany({
      where: { loanId }
    });

    const instalmentDates = calculateInstalmentDates(startDate, frequency, tenure);
    const instalments = instalmentDates.map((date, index) => ({
      loanId,
      instalmentNo: index + 1,
      dueDate: date,
      dueAmount: perInstalment,
      status: 'upcoming'
    }));

    await prisma.loanInstalment.createMany({
      data: instalments
    });

    // Reset paid count
    await prisma.loan.update({
      where: { id: loanId },
      data: { paidCount: 0 }
    });
  }

  // Log activity
  try {
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'update',
        entityType: 'loan',
        entityId: loanId,
        newValue: JSON.stringify({ principal, tenure, coreChanged })
      }
    });
  } catch (e) {
    console.error('Failed to create audit log:', e);
  }

  revalidatePath(`/loans/${loanId}`);
  revalidatePath('/loans');
  
  return { success: true };
}
