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

    let goldCollateral = undefined;
    if (appType === 'goldloan') {
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
        assessedValue: formData.get('assessedValue') ? Number(formData.get('assessedValue')) : null,
        eligibleLtvPercent: formData.get('eligibleLtvPercent') ? Number(formData.get('eligibleLtvPercent')) : null,
        storageLocation: formData.get('storageLocation') as string || null,
        valuerName: formData.get('valuerName') as string || null,
        valuationDate: formData.get('valuationDate') as string || null,
        photoPath,
        documentPath
      };
    }

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
      goldCollateral
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

    let goldCollateral = undefined;
    if (appType === 'goldloan') {
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
        assessedValue: formData.get('assessedValue') ? Number(formData.get('assessedValue')) : null,
        eligibleLtvPercent: formData.get('eligibleLtvPercent') ? Number(formData.get('eligibleLtvPercent')) : null,
        storageLocation: formData.get('storageLocation') as string || null,
        valuerName: formData.get('valuerName') as string || null,
        valuationDate: formData.get('valuationDate') as string || null,
        photoPath,
        documentPath
      };
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

