'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { calculateEndDate, calculateInstalmentDates, formatDateISO } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { checkLimit } from '@/lib/subscription';
import { getActiveBranchId } from '@/lib/branch';
import { assertModuleEnabled } from '@/lib/moduleGate';
import fs from 'fs';
import path from 'path';
import { encryptAadharNumber } from '@/lib/pii';
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES, validateFileBytes } from '@/lib/fileUpload';

const UPLOAD_DIR = path.join(process.cwd(), 'private', 'uploads');

async function saveUploadedFile(file: File, tenantId: string, subfolder: string): Promise<string> {
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
    throw new Error(`File type not allowed: ${file.type}. Only JPEG, PNG, WebP, and PDF are accepted.`);
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error('File exceeds the 5 MB limit.');
  }
  const dir = path.join(UPLOAD_DIR, tenantId, subfolder);
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(file.name).replace(/[^a-zA-Z0-9.]/g, '').toLowerCase() || '';
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(dir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!validateFileBytes(buffer, file.type)) {
    throw new Error('Invalid file signature. File may be corrupted or spoofed.');
  }
  fs.writeFileSync(filePath, buffer);
  return `/api/files/${tenantId}/${subfolder}/${safeName}`;
}

export async function createLoan(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const createdById = session?.user?.id;
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const activeBranchId = await getActiveBranchId();

  if (!createdById || !['admin', 'superadmin', 'developer', 'agent'].includes(role)) {
    redirect('/collection');
  }

  if (role !== 'developer' && !activeBranchId) {
    return { error: 'No active branch selected.' };
  }

  // Enforce module gate — block loan creation if microlending is removed from branch
  if (role !== 'developer') {
    try {
      await assertModuleEnabled('microlending');
    } catch (err: any) {
      return { error: err.message as string };
    }
  }

  // Enforce subscription loan limit
  try {
    await checkLimit(tenantId, 'loans');
  } catch (err: any) {
    return { error: err.message as string };
  }

  const customerId = formData.get('customerId') as string;
  const principal = Number(formData.get('principal')) || 0;
  const interestType = (formData.get('deductionType') as string) || 'upfront_fixed';
  // Note: we still use 'deduction' name from form for the rate/amount input to match DB if needed,
  // but let's treat it as the rate/amount.
  const rate = Number(formData.get('deduction')) || 0;
  const frequency = formData.get('frequency') as string;
  const tenure = Number(formData.get('tenure')) || 1;
  const startDateStr = formData.get('startDate') as string;
  const packageId = formData.get('packageId') as string || null;
  const penaltyRate = Number(formData.get('penaltyRate')) || 0;
  const voucherRef = formData.get('voucherRef') as string;
  const loanType = formData.get('loanType') as string || 'cheque';
  const collateralDetails = formData.get('collateralDetails') as string || null;
  const guarantorIdFromForm = formData.get('guarantorId') as string || null;
  const guarantorName = formData.get('guarantorName') as string;
  const guarantorPhone = formData.get('guarantorPhone') as string;
  const guarantorAadhar = formData.get('guarantorAadhar') as string;
  const guarantorAddress = formData.get('guarantorAddress') as string;
  const guarantorRelation = formData.get('guarantorRelation') as string;
  const guarantorPhotoFile = formData.get('guarantorPhoto') as File | null;

  const startDate = new Date(startDateStr);
  const endDate = calculateEndDate(startDate, frequency, tenure);

  let disbursed = principal;
  let totalPayable = principal;
  let perInstalment = 0;
  let deduction = 0; // actual amount deducted upfront

  if (interestType === 'upfront_fixed') {
    deduction = rate;
    disbursed = principal - deduction;
    totalPayable = principal;
    perInstalment = Math.round(principal / tenure);
  } else if (interestType === 'upfront_percentage') {
    deduction = principal * (rate / 100);
    disbursed = principal - deduction;
    totalPayable = principal;
    perInstalment = Math.round(principal / tenure);
  } else if (interestType === 'emi_flat') {
    const interestAmount = principal * (rate / 100);
    disbursed = principal;
    totalPayable = principal + interestAmount;
    perInstalment = Math.round(totalPayable / tenure);
  } else if (interestType === 'emi_floating') {
    let periodsPerYear = 12;
    if (frequency === 'daily') periodsPerYear = 365;
    else if (frequency === 'weekly') periodsPerYear = 52;
    else if (frequency === 'biweekly') periodsPerYear = 26;

    const r = (rate / 100) / periodsPerYear;
    disbursed = principal;
    if (r === 0) {
      perInstalment = Math.round(principal / tenure);
    } else {
      const emi = principal * r * Math.pow(1 + r, tenure) / (Math.pow(1 + r, tenure) - 1);
      perInstalment = Math.round(emi);
    }
    totalPayable = perInstalment * tenure;
  }

  // Ensure totalPayable matches perInstalment * tenure for EMI types
  if (interestType === 'emi_flat' || interestType === 'emi_floating') {
    totalPayable = perInstalment * tenure;
  }

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

  // Create or Update guarantor if provided
  let guarantorId = guarantorIdFromForm;
  if (guarantorName && guarantorPhone) {
    let gPhoto = null;
    if (guarantorPhotoFile && guarantorPhotoFile.size > 0) {
      try {
        gPhoto = await saveUploadedFile(guarantorPhotoFile, tenantId, 'guarantors');
      } catch (e) {
        console.error('Failed to upload guarantor photo:', e);
      }
    }

    const gData = {
      customerId,
      name: guarantorName,
      phone: guarantorPhone,
      aadharNumber: guarantorAadhar ? encryptAadharNumber(guarantorAadhar) : null,
      address: guarantorAddress || null,
      relation: guarantorRelation || null,
      photo: gPhoto || undefined
    };

    if (guarantorId) {
      await prisma.guarantor.update({
        where: { id: guarantorId },
        data: gData
      });
    } else {
      const guarantor = await prisma.guarantor.create({
        data: gData
      });
      guarantorId = guarantor.id;
    }
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
  if (activeBranchId && customer.branchId && customer.branchId !== activeBranchId) {
    return { error: 'Customer is not in the active branch.' };
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

  // ── Automatic Template Logic ─────────────────────────────────────────────
  // Check if a package exists for this tenure/frequency combination.
  // If not, create one automatically with the requested naming convention.
  const frequencyLabel = frequency.charAt(0).toUpperCase() + frequency.slice(1);
  const unitLabel = frequency === 'daily' ? 'Day' : frequency === 'weekly' ? 'Week' : 'Month';
  const generatedName = `${tenure}-${unitLabel} ${frequencyLabel}`;

  let finalPackageId = packageId;
  const existingPkg = await prisma.loanPackage.findFirst({
    where: { tenantId, appType, frequency, tenure, status: 'active' }
  });

  if (!existingPkg) {
    const newPkg = await prisma.loanPackage.create({
      data: {
        tenantId,
        appType,
        name: generatedName,
        principal,
        deduction,
        deductionType: interestType,
        frequency,
        tenure,
        perInstalment,
        penaltyRate,
        status: 'active'
      }
    });
    finalPackageId = newPkg.id;
  } else {
    finalPackageId = existingPkg.id;
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Process security cheques
  const cheques: any[] = [];
  let i = 0;
  while (formData.has(`bankName_${i}`)) {
    const bankName = formData.get(`bankName_${i}`) as string;
    const chequeNumber = formData.get(`chequeNumber_${i}`) as string;
    const file = formData.get(`chequeImage_${i}`) as File | null;
    let imagePath = null;
    if (file && file.size > 0) {
      try {
        imagePath = await saveUploadedFile(file, tenantId, 'cheques');
      } catch (e) {
        console.error('Failed to upload cheque photo:', e);
      }
    }

    if (bankName && chequeNumber) {
      cheques.push({ bankName, chequeNumber, imagePath, customerId });
    }
    i++;
  }

  // Create Loan & Instalments
  const loan = await prisma.loan.create({
    data: {
      tenantId,
      branchId: activeBranchId,
      loanCode,
      customerId,
      packageId: finalPackageId,
      loanType,
      appType,
      collateralDetails,
      guarantorId,
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
      totalPayable,
      status: role === 'agent' ? 'pending_review' : 'active',
      totalInstalments: tenure,
      createdById,
      instalments: {
        create: instalments
      },
      securityCheques: {
        create: cheques
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

  if (role === 'agent' && activeBranchId) {
    await prisma.systemNotification.create({
      data: {
        tenantId,
        branchId: activeBranchId,
        appType,
        type: 'loan_review',
        icon: 'assignment',
        title: 'Loan pending review',
        message: `Agent submitted loan ${loanCode} for approval.`,
        link: `/approvals`,
        targetRole: 'admin',
      },
    }).catch(() => {});
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
  const principal = Number(formData.get('principal')) || 0;
  const interestType = (formData.get('deductionType') as string) || 'upfront_fixed';
  const rate = Number(formData.get('deduction')) || 0;
  const frequency = formData.get('frequency') as string;
  const tenure = Number(formData.get('tenure')) || 1;
  const startDateStr = formData.get('startDate') as string;
  const penaltyRate = Number(formData.get('penaltyRate')) || 0;
  const voucherRef = formData.get('voucherRef') as string;
  const loanType = formData.get('loanType') as string;
  const collateralDetails = formData.get('collateralDetails') as string;
  const guarantorName = formData.get('guarantorName') as string;
  const guarantorPhone = formData.get('guarantorPhone') as string;
  const guarantorAadhar = formData.get('guarantorAadhar') as string;
  const guarantorAddress = formData.get('guarantorAddress') as string;
  const guarantorRelation = formData.get('guarantorRelation') as string;
  const guarantorPhotoFile = formData.get('guarantorPhoto') as File | null;

  const startDate = new Date(startDateStr);
  const endDate = calculateEndDate(startDate, frequency, tenure);

  let disbursed = principal;
  let totalPayable = principal;
  let perInstalment = 0;
  let deduction = 0;

  if (interestType === 'upfront_fixed') {
    deduction = rate;
    disbursed = principal - deduction;
    totalPayable = principal;
    perInstalment = Math.round(principal / tenure);
  } else if (interestType === 'upfront_percentage') {
    deduction = principal * (rate / 100);
    disbursed = principal - deduction;
    totalPayable = principal;
    perInstalment = Math.round(principal / tenure);
  } else if (interestType === 'emi_flat') {
    const interestAmount = principal * (rate / 100);
    disbursed = principal;
    totalPayable = principal + interestAmount;
    perInstalment = Math.round(totalPayable / tenure);
  } else if (interestType === 'emi_floating') {
    let periodsPerYear = 12;
    if (frequency === 'daily') periodsPerYear = 365;
    else if (frequency === 'weekly') periodsPerYear = 52;
    else if (frequency === 'biweekly') periodsPerYear = 26;

    const r = (rate / 100) / periodsPerYear;
    disbursed = principal;
    if (r === 0) {
      perInstalment = Math.round(principal / tenure);
    } else {
      const emi = principal * r * Math.pow(1 + r, tenure) / (Math.pow(1 + r, tenure) - 1);
      perInstalment = Math.round(emi);
    }
    totalPayable = perInstalment * tenure;
  }

  if (interestType === 'emi_flat' || interestType === 'emi_floating') {
    totalPayable = perInstalment * tenure;
  }

  // Fetch loan to ensure it exists and belongs to tenant (scope by appType too)
  const appType = await getUserAppType();
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, tenantId, appType },
    include: { guarantor: true }
  });

  if (!loan) return { error: 'Loan not found' };

  // 1. Pre-validation: Check if core fields changed and guard financial activity
  const coreChanged = 
    Number(loan.principal) !== principal ||
    Number(loan.tenure) !== tenure ||
    loan.frequency !== frequency ||
    formatDateISO(new Date(loan.startDate)) !== startDateStr;

  if (coreChanged) {
    // Phase 1.6: Guard instalment regeneration after financial activity
    const { hasFinancialActivity } = await import('@/lib/repayments');
    if (await hasFinancialActivity(loanId)) {
      return {
        error:
          'Cannot reschedule a loan that already has payment history. ' +
          'Please close and renew this loan instead.',
      };
    }
  }

  // 2. Wrap all modifications in a transaction (Phase 1.3)
  await prisma.$transaction(async (tx) => {
    // Update or Create guarantor
    let currentGuarantorId = loan.guarantorId;
    if (guarantorName && guarantorPhone) {
      let gPhoto = loan.guarantor?.photo || null;
      if (guarantorPhotoFile && guarantorPhotoFile.size > 0) {
        try {
          gPhoto = await saveUploadedFile(guarantorPhotoFile, tenantId, 'guarantors');
        } catch (e) {
          console.error('Failed to upload guarantor photo:', e);
        }
      }

      if (loan.guarantor) {
        await tx.guarantor.update({
          where: { id: loan.guarantorId! },
          data: { 
            name: guarantorName, 
            phone: guarantorPhone,
            aadharNumber: guarantorAadhar ? encryptAadharNumber(guarantorAadhar) : undefined,
            address: guarantorAddress || undefined,
            relation: guarantorRelation || undefined,
            photo: gPhoto
          }
        });
      } else {
        const g = await tx.guarantor.create({
          data: {
            customerId: loan.customerId,
            name: guarantorName,
            phone: guarantorPhone,
            aadharNumber: guarantorAadhar ? encryptAadharNumber(guarantorAadhar) : null,
            address: guarantorAddress || null,
            relation: guarantorRelation || null,
            photo: gPhoto
          }
        });
        currentGuarantorId = g.id;
      }
    }

    // Update Loan
    await tx.loan.update({
      where: { id: loanId },
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

    // Regenerate schedule if core fields changed
    if (coreChanged) {
      await tx.instalment.deleteMany({ where: { loanId } });

      const instalmentDates = calculateInstalmentDates(startDate, frequency, tenure);
      const instalments = instalmentDates.map((date, index) => ({
        loanId,
        instalmentNo: index + 1,
        dueDate: date,
        dueAmount: perInstalment,
        status: 'upcoming' as const,
      }));

      await tx.instalment.createMany({ data: instalments });

      // Reset paid count
      await tx.loan.update({
        where: { id: loanId },
        data: { paidCount: 0 },
      });
    }
  });

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
