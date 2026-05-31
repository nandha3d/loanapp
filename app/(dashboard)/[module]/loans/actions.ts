'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { calculateEndDate, formatDateISO } from '@/lib/utils';
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
import { canCreateLoanForRole, validateLoanNumericInputs } from '@/lib/loanPolicy';
import { calculateLoanPreview } from '@/lib/loanCalculator';
import { validateGuarantorPhone } from '@/lib/guarantorPolicy';
import { modulePath } from '@/types/modules';
import { findApprovalNotificationTarget } from '@/lib/approvalNotifications';
import { notify } from '@/lib/notify/events';

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

  if (!createdById) {
    redirect(modulePath(appType, '/collection'));
  }

  if (!canCreateLoanForRole(role)) {
    return { error: 'Unauthorized to create loans.' };
  }

  if (role !== 'developer' && !activeBranchId) {
    return { error: 'No active branch selected.' };
  }

  // Enforce module gate — block loan creation if module is removed from branch
  if (role !== 'developer') {
    try {
      await assertModuleEnabled(appType as any);
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
  const principal = Number(formData.get('principal'));
  const interestType = (formData.get('deductionType') as string) || 'upfront_fixed';
  // Note: we still use 'deduction' name from form for the rate/amount input to match DB if needed,
  // but let's treat it as the rate/amount.
  const rate = Number(formData.get('deduction'));
  const frequency = formData.get('frequency') as string;
  const tenure = Number(formData.get('tenure'));
  const startDateStr = formData.get('startDate') as string;
  const packageId = formData.get('packageId') as string || null;
  const penaltyRate = Number(formData.get('penaltyRate'));
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
  const dueDay = formData.get('dueDay') ? Number(formData.get('dueDay')) : null;

  const numericValidation = validateLoanNumericInputs({ principal, rate, tenure, penaltyRate });
  if (!numericValidation.valid) {
    return { error: numericValidation.error };
  }

  const startDate = new Date(startDateStr);
  if (!startDateStr || Number.isNaN(startDate.getTime())) {
    return { error: 'Invalid start date.' };
  }
  const endDate = calculateEndDate(startDate, frequency, tenure);
  const calculation = calculateLoanPreview({
    principal,
    interestType,
    interestRate: rate,
    tenure,
    frequency,
    startDate,
    dueDay,
  });
  const disbursed = calculation.disbursedAmount;
  const totalPayable = calculation.totalPayable;
  const perInstalment = calculation.perInstalment;
  const deduction = calculation.deduction;

  // Generate Loan Code — frequency-aware prefix & counter
  const freqPrefixDefaults: Record<string, string> = {
    daily: 'DL', weekly: 'WK', biweekly: 'BW', monthly: 'ML',
  };
  const prefixKey = `loan_prefix_${frequency}`;
  const counterKey = `loan_counter_${frequency}`;
  const prefix = await getSetting(tenantId, prefixKey, freqPrefixDefaults[frequency] || 'LN');
  const counterStr = await getSetting(tenantId, counterKey, '0');
  const counter = parseInt(counterStr) + 1;
  const loanCode = `${prefix}${String(counter).padStart(4, '0')}`;
  
  await prisma.appSetting.upsert({
    where: { tenantId_key: { tenantId, key: counterKey } },
    update: { value: counter.toString() },
    create: { tenantId, key: counterKey, value: counter.toString(), group: 'general' }
  });

  // Fetch customer before guarantor writes so cross-field validation can run before mutations.
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, appType, status: 'active' },
  });

  if (!customer) {
    return { error: 'Customer not found or inactive. Please select a valid customer.' };
  }
  if (activeBranchId && customer.branchId && customer.branchId !== activeBranchId) {
    return { error: 'Customer is not in the active branch.' };
  }

  const guarantorPhoneValidation = validateGuarantorPhone({
    customerPhone: customer.phone,
    guarantorPhone,
  });
  if (!guarantorPhoneValidation.valid) {
    return { error: guarantorPhoneValidation.error };
  }

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

  const instalments = calculation.schedule.map((item) => ({
    instalmentNo: item.instalmentNo,
    dueDate: item.dueDate,
    dueAmount: item.dueAmount,
    status: 'upcoming'
  }));

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
      redirect(modulePath(appType, '/loans/new?error=package_not_found'));
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
      loanType: appType === 'goldloan' ? 'gold' : loanType,
      appType,
      collateralDetails,
      guarantorId,
      principal,
      deduction,
      deductionType: interestType,
      disbursed,
      frequency,
      dueDay,
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

  // For gold loan module, write the GoldLoanCollateral row transactionally
  if (appType === 'goldloan') {
    const packetNo = formData.get('packetNo') as string || null;
    const ornamentDescription = formData.get('ornamentDescription') as string || null;
    const grossWeightGrams = Number(formData.get('grossWeightGrams')) || 0;
    const netWeightGrams = Number(formData.get('netWeightGrams')) || 0;
    const purityKarat = formData.get('purityKarat') as string || '22K';
    const marketRatePerGram = formData.get('marketRatePerGram') ? Number(formData.get('marketRatePerGram')) : null;
    const assessedValue = formData.get('assessedValue') ? Number(formData.get('assessedValue')) : null;
    const eligibleLtvPercent = formData.get('eligibleLtvPercent') ? Number(formData.get('eligibleLtvPercent')) : null;
    const storageLocation = formData.get('storageLocation') as string || null;
    const valuerName = formData.get('valuerName') as string || null;
    const valuationDateStr = formData.get('valuationDate') as string || null;
    const valuationDate = valuationDateStr ? new Date(valuationDateStr) : null;
    const photoFile = formData.get('goldPhoto') as File | null;
    const docFile = formData.get('goldValuationDoc') as File | null;

    let photoPath = null;
    let documentPath = null;
    if (photoFile && photoFile.size > 0) {
      try {
        photoPath = await saveUploadedFile(photoFile, tenantId, 'gold_photos');
      } catch (e) {
        console.error('Failed to upload gold photo:', e);
      }
    }
    if (docFile && docFile.size > 0) {
      try {
        documentPath = await saveUploadedFile(docFile, tenantId, 'gold_docs');
      } catch (e) {
        console.error('Failed to upload gold document:', e);
      }
    }

    await prisma.goldLoanCollateral.create({
      data: {
        tenantId,
        branchId: activeBranchId,
        loanId: loan.id,
        customerId,
        packetNo,
        ornamentDescription,
        grossWeightGrams,
        netWeightGrams,
        purityKarat,
        marketRatePerGram,
        assessedValue,
        eligibleLtvPercent,
        storageLocation,
        valuerName,
        valuationDate,
        photoPath,
        documentPath,
        releaseStatus: 'pledged'
      }
    });

    // Write audit details to loan.collateralDetails as JSON snapshot
    await prisma.loan.update({
      where: { id: loan.id },
      data: {
        collateralDetails: JSON.stringify({
          packetNo,
          ornamentDescription,
          grossWeightGrams,
          netWeightGrams,
          purityKarat,
          marketRatePerGram,
          assessedValue,
          eligibleLtvPercent,
          storageLocation,
          valuerName,
          valuationDateStr,
          photoPath,
          documentPath
        })
      }
    });
  }

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
    const targetUserId = await findApprovalNotificationTarget({
      tenantId,
      appType,
      agentId: createdById,
      branchId: activeBranchId,
    });

    await prisma.systemNotification.create({
      data: {
        tenantId,
        branchId: activeBranchId,
        targetUserId,
        appType,
        type: 'loan_review',
        icon: 'assignment',
        title: 'Loan pending review',
        message: `Agent submitted loan ${loanCode} for approval.`,
        link: modulePath(appType, '/approvals'),
        targetRole: 'admin',
      },
    }).catch(() => {});
  }
  // Feature 9: Auto-record capital reduction on loan disbursement
  if (loan.status === 'active') {
    try {
      await prisma.accountEntry.create({
        data: {
          tenantId,
          branchId: activeBranchId || undefined,
          entryDate: startDate,
          type: 'loan_disburse',
          category: 'cash',
          amount: disbursed,
          description: `Loan ${loanCode} disbursed to customer`,
          referenceId: loan.id,
          referenceType: 'loan',
          createdBy: createdById || undefined,
        },
      });
    } catch (e) {
      console.error('Failed to create accounting entry:', e);
    }

    const { autoPostLoanDisburse } = await import('@/lib/accounting/autoPost');
    autoPostLoanDisburse({
      tenantId,
      loanId: loan.id,
      loanCode,
      amount: disbursed,
      date: startDate,
      branchId: activeBranchId || null,
      createdById: createdById || null,
      category: 'cash',
    }).catch(() => {});

    const firstInstalment = instalments[0]?.dueDate;
    notify({
      tenantId,
      event: 'loan_disbursed',
      phone: customer.phone,
      email: customer.email ?? undefined,
      data: {
        name: customer.name,
        amount: disbursed.toLocaleString('en-IN'),
        loanCode,
        firstDue: firstInstalment ? new Date(firstInstalment).toLocaleDateString('en-IN') : '-',
      },
      meta: { entityType: 'loan', entityId: loan.id },
    }).catch((err) => console.error('Failed to send loan disburse notification', err));
  }

  revalidatePath(modulePath(appType, '/loans'));
  redirect(modulePath(appType, `/loans/${loan.loanCode}`));
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
  const guarantorIdFromForm = formData.get('guarantorId') as string;
  const guarantorPhotoFile = formData.get('guarantorPhoto') as File | null;
  const dueDay = formData.get('dueDay') ? Number(formData.get('dueDay')) : null;

  const startDate = new Date(startDateStr);
  const endDate = calculateEndDate(startDate, frequency, tenure);
  const calculation = calculateLoanPreview({
    principal,
    interestType,
    interestRate: rate,
    tenure,
    frequency,
    startDate,
    dueDay,
  });
  const disbursed = calculation.disbursedAmount;
  const totalPayable = calculation.totalPayable;
  const perInstalment = calculation.perInstalment;
  const deduction = calculation.deduction;

  // Fetch loan to ensure it exists and belongs to tenant (scope by appType too)
  const appType = await getUserAppType();
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, tenantId, appType },
    include: { guarantor: true, customer: { select: { phone: true } }, goldCollateral: true }
  });

  if (!loan) return { error: 'Loan not found' };
  const guarantorPhoneValidation = validateGuarantorPhone({
    customerPhone: loan.customer?.phone,
    guarantorPhone,
  });
  if (!guarantorPhoneValidation.valid) {
    return { error: guarantorPhoneValidation.error };
  }

  // 1. Pre-validation: Check if core fields changed and guard financial activity
  const coreChanged = 
    Number(loan.principal) !== principal ||
    Number(loan.tenure) !== tenure ||
    loan.frequency !== frequency ||
    loan.dueDay !== dueDay ||
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
    let currentGuarantorId = guarantorIdFromForm || loan.guarantorId;
    if (guarantorName && guarantorPhone) {
      let gPhoto = loan.guarantor?.photo || null;
      if (guarantorPhotoFile && guarantorPhotoFile.size > 0) {
        try {
          gPhoto = await saveUploadedFile(guarantorPhotoFile, tenantId, 'guarantors');
        } catch (e) {
          console.error('Failed to upload guarantor photo:', e);
        }
      }

      if (currentGuarantorId) {
        await tx.guarantor.update({
          where: { id: currentGuarantorId },
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
        dueDay,
        tenure,
        startDate,
        endDate,
        perInstalment,
        penaltyRate,
        voucherRef,
        loanType: appType === 'goldloan' ? 'gold' : loanType,
        collateralDetails,
        totalPayable,
        guarantorId: currentGuarantorId,
        totalInstalments: tenure
      }
    });

    // Update GoldLoanCollateral if appType === 'goldloan'
    if (appType === 'goldloan') {
      const packetNo = formData.get('packetNo') as string || null;
      const ornamentDescription = formData.get('ornamentDescription') as string || null;
      const grossWeightGrams = Number(formData.get('grossWeightGrams')) || 0;
      const netWeightGrams = Number(formData.get('netWeightGrams')) || 0;
      const purityKarat = formData.get('purityKarat') as string || '22K';
      const marketRatePerGram = formData.get('marketRatePerGram') ? Number(formData.get('marketRatePerGram')) : null;
      const assessedValue = formData.get('assessedValue') ? Number(formData.get('assessedValue')) : null;
      const eligibleLtvPercent = formData.get('eligibleLtvPercent') ? Number(formData.get('eligibleLtvPercent')) : null;
      const storageLocation = formData.get('storageLocation') as string || null;
      const valuerName = formData.get('valuerName') as string || null;
      const valuationDateStr = formData.get('valuationDate') as string || null;
      const valuationDate = valuationDateStr ? new Date(valuationDateStr) : null;
      const photoFile = formData.get('goldPhoto') as File | null;
      const docFile = formData.get('goldValuationDoc') as File | null;

      let photoPath = (loan as any).goldCollateral?.photoPath || null;
      let documentPath = (loan as any).goldCollateral?.documentPath || null;

      if (photoFile && photoFile.size > 0) {
        try {
          photoPath = await saveUploadedFile(photoFile, tenantId, 'gold_photos');
        } catch (e) {
          console.error('Failed to upload gold photo:', e);
        }
      }
      if (docFile && docFile.size > 0) {
        try {
          documentPath = await saveUploadedFile(docFile, tenantId, 'gold_docs');
        } catch (e) {
          console.error('Failed to upload gold document:', e);
        }
      }

      await tx.goldLoanCollateral.upsert({
        where: { loanId },
        update: {
          packetNo,
          ornamentDescription,
          grossWeightGrams,
          netWeightGrams,
          purityKarat,
          marketRatePerGram,
          assessedValue,
          eligibleLtvPercent,
          storageLocation,
          valuerName,
          valuationDate,
          photoPath,
          documentPath
        },
        create: {
          tenantId,
          branchId: loan.branchId,
          loanId,
          customerId: loan.customerId,
          packetNo,
          ornamentDescription,
          grossWeightGrams,
          netWeightGrams,
          purityKarat,
          marketRatePerGram,
          assessedValue,
          eligibleLtvPercent,
          storageLocation,
          valuerName,
          valuationDate,
          photoPath,
          documentPath,
          releaseStatus: 'pledged'
        }
      });

      await tx.loan.update({
        where: { id: loanId },
        data: {
          collateralDetails: JSON.stringify({
            packetNo,
            ornamentDescription,
            grossWeightGrams,
            netWeightGrams,
            purityKarat,
            marketRatePerGram,
            assessedValue,
            eligibleLtvPercent,
            storageLocation,
            valuerName,
            valuationDateStr,
            photoPath,
            documentPath
          })
        }
      });
    }

    // Regenerate schedule if core fields changed
    if (coreChanged) {
      await tx.instalment.deleteMany({ where: { loanId } });

      const instalments = calculation.schedule.map((item) => ({
        loanId,
        instalmentNo: item.instalmentNo,
        dueDate: item.dueDate,
        dueAmount: item.dueAmount,
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

  revalidatePath(`/loans/${loan.loanCode}`);
  revalidatePath('/loans');
  
  return { success: true };
}

export async function requestLoanEdit(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  const tenantId = await getDefaultTenantId();

  if (!userId) {
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
  const guarantorIdFromForm = formData.get('guarantorId') as string;
  const reason = formData.get('reason') as string || '';

  const appType = await getUserAppType();
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, tenantId, appType },
    include: { guarantor: true, customer: { select: { phone: true } } }
  });

  if (!loan) return { error: 'Loan not found' };
  const guarantorPhoneValidation = validateGuarantorPhone({
    customerPhone: loan.customer?.phone,
    guarantorPhone,
  });
  if (!guarantorPhoneValidation.valid) {
    return { error: guarantorPhoneValidation.error };
  }

  // Check if core fields changed and guard financial activity
  const coreChanged = 
    Number(loan.principal) !== principal ||
    Number(loan.tenure) !== tenure ||
    loan.frequency !== frequency ||
    formatDateISO(new Date(loan.startDate)) !== startDateStr;

  if (coreChanged) {
    const { hasFinancialActivity } = await import('@/lib/repayments');
    if (await hasFinancialActivity(loanId)) {
      return { error: 'Instalment schedule cannot be regenerated: loan has recorded repayments or lock history. Please close and renew instead.' };
    }
  }

  const proposedChanges: any = {};
  if (Number(loan.principal) !== principal) proposedChanges.principal = principal;
  if (loan.deductionType !== interestType) proposedChanges.deductionType = interestType;
  if (Number(loan.deduction) !== rate) proposedChanges.deduction = rate;
  if (loan.frequency !== frequency) proposedChanges.frequency = frequency;
  if (Number(loan.tenure) !== tenure) proposedChanges.tenure = tenure;
  if (formatDateISO(new Date(loan.startDate)) !== startDateStr) proposedChanges.startDate = startDateStr;
  if (Number(loan.penaltyRate) !== penaltyRate) proposedChanges.penaltyRate = penaltyRate;
  if (loan.voucherRef !== voucherRef) proposedChanges.voucherRef = voucherRef;
  if (loan.loanType !== loanType) proposedChanges.loanType = loanType;
  if (loan.collateralDetails !== collateralDetails) proposedChanges.collateralDetails = collateralDetails;
  
  if (loan.guarantor?.name !== guarantorName) proposedChanges.guarantorName = guarantorName;
  if (loan.guarantor?.phone !== guarantorPhone) proposedChanges.guarantorPhone = guarantorPhone;
  if (loan.guarantor?.address !== guarantorAddress) proposedChanges.guarantorAddress = guarantorAddress;
  if (loan.guarantor?.relation !== guarantorRelation) proposedChanges.guarantorRelation = guarantorRelation;
  if (guarantorIdFromForm && loan.guarantorId !== guarantorIdFromForm) proposedChanges.guarantorId = guarantorIdFromForm;

  if (guarantorAadhar) {
    const { decryptAadharNumber, encryptAadharNumber } = await import('@/lib/pii');
    const decryptedCurrentAadhar = loan.guarantor?.aadharNumber ? decryptAadharNumber(loan.guarantor.aadharNumber) : '';
    if (decryptedCurrentAadhar !== guarantorAadhar) {
      proposedChanges.guarantorAadhar = encryptAadharNumber(guarantorAadhar);
    }
  }

  if (Object.keys(proposedChanges).length === 0) {
    return { error: 'No changes detected.' };
  }

  await prisma.approvalRequest.create({
    data: {
      tenantId,
      appType,
      requestType: 'loan_edit',
      entityType: 'loan',
      entityId: loanId,
      requestedById: userId,
      requestedChanges: JSON.stringify(proposedChanges),
      reason,
      status: 'pending'
    }
  });

  if (loan.branchId) {
    const targetUserId = await findApprovalNotificationTarget({
      tenantId,
      appType,
      agentId: userId,
      branchId: loan.branchId,
    });

    await prisma.systemNotification.create({
      data: {
        tenantId,
        branchId: loan.branchId,
        targetUserId,
        appType,
        type: 'loan_edit_review',
        icon: 'rate_review',
        title: 'Loan edit pending review',
        message: `Agent requested edits for loan ${loan.loanCode}.`,
        link: `/approvals`,
        targetRole: 'admin',
      },
    }).catch(() => {});
  }

  revalidatePath(`/loans/${loan.loanCode}`);
  revalidatePath('/loans');
  
  return { success: true };
}
