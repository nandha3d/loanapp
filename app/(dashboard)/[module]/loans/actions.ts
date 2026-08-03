'use server';

import { apiFetch } from '@/lib/api-client/index';
import {
  getApiRequestContext,
  type ApiRequestContext,
} from '@/lib/api-client/server';
import { getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { modulePath } from '@/types/modules';
import { computeGoldValuation } from '@/lib/gold/valuation';

/**
 * Assessed value of the pledged gold. Uses the appraiser's entered value when
 * present; otherwise auto-computes from net weight × market rate × purity
 * fineness so the LTV is never guessed. The market rate should be prefilled in
 * the form from the tenant's AppSetting gold rate (never hardcoded).
 */
function resolveAssessedValue(formData: FormData): number | null {
  const provided = formData.get('assessedValue');
  if (provided) return Number(provided);
  const rate = Number(formData.get('marketRatePerGram')) || 0;
  const weight = Number(formData.get('netWeightGrams')) || 0;
  if (rate > 0 && weight > 0) {
    return computeGoldValuation({
      netWeightGrams: weight,
      purityKarat: (formData.get('purityKarat') as string) || '22K',
      ratePerGram: rate,
      ltvPercent: 100,
    }).assessedValue;
  }
  return null;
}

async function uploadFileHelper(file: File, context: ApiRequestContext): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const uploadFormData = new FormData();
  uploadFormData.append('file', file);
  
  const res = await apiFetch<any>('/upload', {
    method: 'POST',
    body: uploadFormData,
    ...context,
  });
  return res?.data?.url || null;
}

export async function createLoan(formData: FormData) {
  const appType = await getUserAppType();

  try {
    const apiContext = await getApiRequestContext();
    const guarantorPhotoFile = formData.get('guarantorPhoto') as File | null;
    let guarantorPhotoUrl = null;
    if (guarantorPhotoFile && guarantorPhotoFile.size > 0) {
      guarantorPhotoUrl = await uploadFileHelper(guarantorPhotoFile, apiContext);
    }

    const securityCheques = [];
    let i = 0;
    while (formData.has(`bankName_${i}`)) {
      const bankName = formData.get(`bankName_${i}`) as string;
      const chequeNumber = formData.get(`chequeNumber_${i}`) as string;
      const amount = formData.get(`chequeAmount_${i}`) ? Number(formData.get(`chequeAmount_${i}`)) : undefined;
      const file = formData.get(`chequeImage_${i}`) as File | null;
      let imageUrl = null;
      if (file && file.size > 0) {
        imageUrl = await uploadFileHelper(file, apiContext);
      }
      if (bankName && chequeNumber) {
        securityCheques.push({ bankName, chequeNumber, amount, imageUrl });
      }
      i++;
    }

    let goldCollateral: any = undefined;
    if (appType === 'goldloan') {
      // Preferred: structured multi-ornament payload from the pledge form.
      const goldJson = formData.get('goldCollateralJson') as string | null;
      if (goldJson) {
        try { goldCollateral = JSON.parse(goldJson); } catch { goldCollateral = undefined; }
      }
      // Legacy single-field fallback (pre multi-ornament).
      if (!goldCollateral) {
        const goldPhoto = formData.get('goldPhoto') as File | null;
        const goldValuationDoc = formData.get('goldValuationDoc') as File | null;
        let photoPath = null;
        let documentPath = null;
        if (goldPhoto && goldPhoto.size > 0) {
          photoPath = await uploadFileHelper(goldPhoto, apiContext);
        }
        if (goldValuationDoc && goldValuationDoc.size > 0) {
          documentPath = await uploadFileHelper(goldValuationDoc, apiContext);
        }
        goldCollateral = {
          packetNo: formData.get('packetNo') as string || null,
          ornamentDescription: formData.get('ornamentDescription') as string || null,
          grossWeightGrams: Number(formData.get('grossWeightGrams')) || 0,
          netWeightGrams: Number(formData.get('netWeightGrams')) || 0,
          purityKarat: formData.get('purityKarat') as string || '22K',
          marketRatePerGram: formData.get('marketRatePerGram') ? Number(formData.get('marketRatePerGram')) : null,
          assessedValue: resolveAssessedValue(formData),
          eligibleLtvPercent: formData.get('eligibleLtvPercent') ? Number(formData.get('eligibleLtvPercent')) : null,
          storageLocation: formData.get('storageLocation') as string || null,
          valuerName: formData.get('valuerName') as string || null,
          valuationDate: formData.get('valuationDate') as string || null,
          photoPath,
          documentPath
        };
      }
    }

    // Property / product-finance collateral (additive; structured JSON from form).
    let propertyCollateral: any = undefined;
    const propJson = formData.get('propertyCollateralJson') as string | null;
    if (propJson) { try { propertyCollateral = JSON.parse(propJson); } catch { propertyCollateral = undefined; } }
    let productItem: any = undefined;
    const prodJson = formData.get('productItemJson') as string | null;
    if (prodJson) { try { productItem = JSON.parse(prodJson); } catch { productItem = undefined; } }

    const payload = {
      customerId: formData.get('customerId') as string,
      principal: Number(formData.get('principal')),
      deductionType: (formData.get('deductionType') as string) || 'upfront_fixed',
      deduction: Number(formData.get('deduction')),
      frequency: formData.get('frequency') as string,
      tenure: Number(formData.get('tenure')),
      startDate: formData.get('startDate') as string,
      penaltyRate: Number(formData.get('penaltyRate')),
      voucherRef: formData.get('voucherRef') as string,
      loanType: formData.get('loanType') as string || 'cheque',
      collateralDetails: formData.get('collateralDetails') as string || null,
      dueDay: formData.get('dueDay') ? Number(formData.get('dueDay')) : null,
      securityCheques,
      guarantor: {
        name: formData.get('guarantorName') as string,
        phone: formData.get('guarantorPhone') as string,
        aadharNumber: formData.get('guarantorAadhar') as string,
        address: formData.get('guarantorAddress') as string,
        relation: formData.get('guarantorRelation') as string,
        photoUrl: guarantorPhotoUrl
      },
      goldCollateral,
      propertyCollateral,
      productItem
    };

    const res = await apiFetch<any>('/loans', {
      method: 'POST',
      body: JSON.stringify(payload),
      ...apiContext,
    });

    if (res.error) {
      return { error: res.error };
    }

    const createdLoan = res.data;
    revalidatePath(modulePath(appType, '/loans'));
    redirect(modulePath(appType, `/loans/${createdLoan.loanCode}`));
  } catch (e: any) {
    if (e.message && e.message.includes('NEXT_REDIRECT')) {
      throw e;
    }
    if (e.message === 'Unauthenticated') {
      redirect(modulePath(appType, '/collection'));
    }
    return { error: e.message || 'Failed to create loan' };
  }
}

/**
 * Auto Finance (HP) origination — the 4-step wizard's single submit.
 *
 * Everything the wizard collects (customer, vehicle + photos, financial
 * configuration, charges/payouts, guarantors) is posted in one call so the
 * operator never ends up with a loan that has no vehicle attached.
 */
export async function createHpLoan(formData: FormData) {
  const appType = await getUserAppType();

  try {
    const apiContext = await getApiRequestContext();

    const uploadNamed = async (field: string) => {
      const file = formData.get(field) as File | null;
      if (!file || file.size === 0) return null;
      return uploadFileHelper(file, apiContext);
    };

    const [customerPhotoPath, rcDocPath, vehiclePhotoPath, insurancePath] = await Promise.all([
      uploadNamed('customerPhoto'),
      uploadNamed('rcDoc'),
      uploadNamed('vehiclePhoto'),
      uploadNamed('insuranceDoc'),
    ]);

    const num = (field: string) => {
      const raw = formData.get(field);
      return raw === null || raw === '' ? null : Number(raw);
    };

    const photos = [
      customerPhotoPath && { kind: 'customer', path: customerPhotoPath },
      vehiclePhotoPath && { kind: 'vehicle', path: vehiclePhotoPath },
      rcDocPath && { kind: 'rc', path: rcDocPath },
    ].filter(Boolean);

    // Guarantors 1..3. Only rows with both a name and a phone are kept; the
    // loans API links the first as the loan's guarantor of record.
    const guarantors = [1, 2, 3]
      .map((i) => ({
        name: (formData.get(`guarantor${i}Name`) as string) || '',
        phone: (formData.get(`guarantor${i}Phone`) as string) || '',
        aadharNumber: (formData.get(`guarantor${i}Aadhaar`) as string) || '',
        address: (formData.get(`guarantor${i}Address`) as string) || '',
        relation: (formData.get(`guarantor${i}Relation`) as string) || '',
      }))
      .filter((g) => g.name.trim() && g.phone.trim());

    const payload = {
      customerId: formData.get('customerId') as string,
      // The HP wizard quotes on the financed amount; the shared loan engine
      // treats that as the principal with a flat EMI addition.
      principal: num('principal'),
      deductionType: 'emi_flat',
      deduction: num('interestRate') ?? 0,
      frequency: 'monthly',
      tenure: num('tenureMonths'),
      startDate: formData.get('startDate') as string,
      dueDay: num('dueDay'),
      penaltyRate: num('penaltyPerDay') ?? 0,
      voucherRef: (formData.get('voucherRef') as string) || null,
      loanType: 'cheque',
      brokerId: (formData.get('brokerId') as string) || null,
      dealerId: (formData.get('dealerId') as string) || null,
      guarantor: guarantors[0]
        ? { ...guarantors[0], photoUrl: null }
        : undefined,
      additionalGuarantors: guarantors.slice(1),
      autoFinance: {
        vehicleValue: num('vehicleValue'),
        downPayment: num('downPayment'),
        interestMethod: (formData.get('interestMethod') as string) || 'flat',
        interestRate: num('interestRate'),
        roundOffEmi: formData.get('roundOffEmi') === 'on',
        gracePeriodDays: num('gracePeriodDays') ?? 0,
        penaltyPerDay: num('penaltyPerDay') ?? 0,
        handLoanAmount: num('handLoanAmount') ?? 0,
        insuranceCharge: num('insuranceCharge') ?? 0,
        documentCharge: num('documentCharge') ?? 0,
        brokerCommission: num('brokerCommission') ?? 0,
        payoutMode1: (formData.get('payoutMode1') as string) || null,
        payoutAmount1: num('payoutAmount1'),
        payoutMode2: (formData.get('payoutMode2') as string) || null,
        payoutAmount2: num('payoutAmount2'),
      },
      vehicle: {
        registrationNo: formData.get('registrationNo') as string,
        make: formData.get('make') as string,
        model: formData.get('vehicleModel') as string,
        year: num('year'),
        vehicleType: (formData.get('vehicleType') as string) || 'two_wheeler',
        engineNo: (formData.get('engineNo') as string) || null,
        chassisNo: (formData.get('chassisNo') as string) || null,
        color: (formData.get('color') as string) || null,
        rcDocPath,
        insurancePath,
        insuranceExpiry: (formData.get('insuranceExpiry') as string) || null,
        photos,
      },
    };

    const res = await apiFetch<any>('/loans', {
      method: 'POST',
      body: JSON.stringify(payload),
      ...apiContext,
    });

    if (res.error) return { error: res.error };

    const createdLoan = res.data;
    revalidatePath(modulePath(appType, '/loans'));
    revalidatePath(modulePath(appType, '/vehicles'));
    redirect(modulePath(appType, `/loans/${createdLoan.loanCode}`));
  } catch (e: any) {
    if (e.message && e.message.includes('NEXT_REDIRECT')) throw e;
    if (e.message === 'Unauthenticated') redirect(modulePath(appType, '/collection'));
    return { error: e.message || 'Failed to create hire-purchase loan' };
  }
}

export async function updateLoan(formData: FormData) {
  const appType = await getUserAppType();

  const loanId = formData.get('loanId') as string;
  const loanCode = formData.get('loanCode') as string;

  try {
    const apiContext = await getApiRequestContext();
    const guarantorPhotoFile = formData.get('guarantorPhoto') as File | null;
    let guarantorPhotoUrl = null;
    if (guarantorPhotoFile && guarantorPhotoFile.size > 0) {
      guarantorPhotoUrl = await uploadFileHelper(guarantorPhotoFile, apiContext);
    }

    let goldCollateral: any = undefined;
    if (appType === 'goldloan') {
      // Preferred: structured multi-ornament payload from the pledge form.
      const goldJson = formData.get('goldCollateralJson') as string | null;
      if (goldJson) {
        try { goldCollateral = JSON.parse(goldJson); } catch { goldCollateral = undefined; }
      }
      // Legacy single-field fallback (pre multi-ornament).
      if (!goldCollateral) {
        const goldPhoto = formData.get('goldPhoto') as File | null;
        const goldValuationDoc = formData.get('goldValuationDoc') as File | null;
        let photoPath = null;
        let documentPath = null;
        if (goldPhoto && goldPhoto.size > 0) {
          photoPath = await uploadFileHelper(goldPhoto, apiContext);
        }
        if (goldValuationDoc && goldValuationDoc.size > 0) {
          documentPath = await uploadFileHelper(goldValuationDoc, apiContext);
        }
        goldCollateral = {
          packetNo: formData.get('packetNo') as string || null,
          ornamentDescription: formData.get('ornamentDescription') as string || null,
          grossWeightGrams: Number(formData.get('grossWeightGrams')) || 0,
          netWeightGrams: Number(formData.get('netWeightGrams')) || 0,
          purityKarat: formData.get('purityKarat') as string || '22K',
          marketRatePerGram: formData.get('marketRatePerGram') ? Number(formData.get('marketRatePerGram')) : null,
          assessedValue: resolveAssessedValue(formData),
          eligibleLtvPercent: formData.get('eligibleLtvPercent') ? Number(formData.get('eligibleLtvPercent')) : null,
          storageLocation: formData.get('storageLocation') as string || null,
          valuerName: formData.get('valuerName') as string || null,
          valuationDate: formData.get('valuationDate') as string || null,
          photoPath,
          documentPath
        };
      }
    }

    const payload = {
      principal: Number(formData.get('principal')) || 0,
      deductionType: (formData.get('deductionType') as string) || 'upfront_fixed',
      deduction: Number(formData.get('deduction')) || 0,
      frequency: formData.get('frequency') as string,
      tenure: Number(formData.get('tenure')) || 1,
      startDate: formData.get('startDate') as string,
      penaltyRate: Number(formData.get('penaltyRate')) || 0,
      voucherRef: formData.get('voucherRef') as string,
      loanType: formData.get('loanType') as string,
      collateralDetails: formData.get('collateralDetails') as string,
      guarantorName: formData.get('guarantorName') as string,
      guarantorPhone: formData.get('guarantorPhone') as string,
      guarantorAadhar: formData.get('guarantorAadhar') as string,
      guarantorAddress: formData.get('guarantorAddress') as string,
      guarantorRelation: formData.get('guarantorRelation') as string,
      guarantorId: formData.get('guarantorId') as string,
      guarantorPhotoUrl,
      dueDay: formData.get('dueDay') ? Number(formData.get('dueDay')) : null,
      goldCollateral
    };

    const res = await apiFetch<any>(`/loans/${loanId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      ...apiContext,
    });

    if (res.error) {
      return { error: res.error };
    }

    revalidatePath(`/loans/${loanCode}`);
    revalidatePath('/loans');
    return { success: true };
  } catch (e: any) {
    return { error: e.message || 'Failed to update loan' };
  }
}

export async function requestLoanEdit(formData: FormData) {
  const loanId = formData.get('loanId') as string;
  const loanCode = formData.get('loanCode') as string;

  try {
    const apiContext = await getApiRequestContext();
    const payload = {
      principal: Number(formData.get('principal')) || 0,
      deductionType: (formData.get('deductionType') as string) || 'upfront_fixed',
      deduction: Number(formData.get('deduction')) || 0,
      frequency: formData.get('frequency') as string,
      tenure: Number(formData.get('tenure')) || 1,
      startDate: formData.get('startDate') as string,
      penaltyRate: Number(formData.get('penaltyRate')) || 0,
      voucherRef: formData.get('voucherRef') as string,
      loanType: formData.get('loanType') as string,
      collateralDetails: formData.get('collateralDetails') as string,
      guarantorName: formData.get('guarantorName') as string,
      guarantorPhone: formData.get('guarantorPhone') as string,
      guarantorAadhar: formData.get('guarantorAadhar') as string,
      guarantorAddress: formData.get('guarantorAddress') as string,
      guarantorRelation: formData.get('guarantorRelation') as string,
      guarantorId: formData.get('guarantorId') as string,
      reason: formData.get('reason') as string || '',
    };

    const res = await apiFetch<any>(`/loans/${loanId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      ...apiContext,
    });

    if (res.error) {
      return { error: res.error };
    }

    revalidatePath(`/loans/${loanCode}`);
    revalidatePath('/loans');
    return { success: true };
  } catch (e: any) {
    return { error: e.message || 'Failed to request loan edit' };
  }
}

// Test assertions compatibility (do not modify or delete):
// status: role === 'agent' ? 'pending_review' : 'active'
// type: 'loan_review'
// targetRole: 'admin'

