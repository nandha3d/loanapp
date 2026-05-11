'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { calculateEndDate, calculateInstalmentDates } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export async function createLoan(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const createdById = session?.user?.id;
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType(); // Always derive appType from session/cookie, never from form

  // Only admin, superadmin and developer can create loans
  if (!createdById || role === 'agent') {
    redirect('/collection');
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
  
  await prisma.appSetting.update({
    where: { tenantId_key: { tenantId, key: 'loan_code_counter' } },
    data: { value: counter.toString() }
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
    redirect('/loans/new?error=customer_not_found');
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

  // Create Loan & Instalments
  const loan = await prisma.loan.create({
    data: {
      tenantId,
      branchId: customer?.branchId,
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

  // Log activity
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

  revalidatePath('/loans');
  redirect(`/loans/${loan.id}`);
}
