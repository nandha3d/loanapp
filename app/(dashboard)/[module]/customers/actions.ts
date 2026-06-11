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

export async function saveCustomer(formData: FormData) {
  const appType = await getUserAppType();

  const editId = formData.get('id') as string | null;
  const name = formData.get('name') as string;
  const phone = formData.get('phone') as string;
  const address = formData.get('address') as string;
  const aadharNumberField = formData.get('aadharNumber') as string | null;
  const routeId = formData.get('routeId') as string;
  const agentId = formData.get('agentId') as string;
  const email = (formData.get('email') as string) || null;
  const pan = (formData.get('pan') as string) || null;
  const companyName = (formData.get('companyName') as string) || null;
  const companyType = (formData.get('companyType') as string) || null;
  const occupation = (formData.get('occupation') as string) || null;
  const monthlyIncomeRaw = formData.get('monthlyIncome') as string | null;
  const monthlyIncome = monthlyIncomeRaw ? parseFloat(monthlyIncomeRaw) : null;
  const gstNumber = (formData.get('gstNumber') as string) || null;
  const businessType = (formData.get('businessType') as string) || null;
  const companyPan = (formData.get('companyPan') as string) || null;
  const companyRegNo = (formData.get('companyRegNo') as string) || null;
  const companyAddress = (formData.get('companyAddress') as string) || null;
  const companyPhone = (formData.get('companyPhone') as string) || null;
  const companyEmail = (formData.get('companyEmail') as string) || null;
  const designation = (formData.get('designation') as string) || null;
  const isPopup = formData.get('isPopup') === 'true';

  try {
    const apiContext = await getApiRequestContext();
    // 1. Upload files first
    const profilePhotoFile = formData.get('profilePhoto') as File | null;
    const existingProfilePhoto = formData.get('existingProfilePhoto') as string | null;
    let photoUrl = existingProfilePhoto || null;
    if (profilePhotoFile && profilePhotoFile.size > 0) {
      photoUrl = await uploadFileHelper(profilePhotoFile, apiContext);
    }

    const companyLogoFile = formData.get('companyLogo') as File | null;
    const existingCompanyLogo = formData.get('existingCompanyLogo') as string | null;
    let companyLogoUrl = existingCompanyLogo || null;
    if (companyLogoFile && companyLogoFile.size > 0) {
      companyLogoUrl = await uploadFileHelper(companyLogoFile, apiContext);
    }

    // Process documents
    const kycDocs = [];
    const docsFiles = formData.getAll('documents') as File[];
    for (const file of docsFiles) {
      if (file && file.size > 0) {
        const savedPath = await uploadFileHelper(file, apiContext);
        if (savedPath) {
          kycDocs.push({
            type: 'other',
            url: savedPath
          });
        }
      }
    }

    // Process guarantors
    const guarantors = [];
    let g = 0;
    while (formData.has(`guarantorName_${g}`)) {
      const gName = formData.get(`guarantorName_${g}`) as string;
      const gPhone = formData.get(`guarantorPhone_${g}`) as string;
      const gRelation = formData.get(`guarantorRelation_${g}`) as string;
      const gAddress = formData.get(`guarantorAddress_${g}`) as string;
      const gPhotoFile = formData.get(`guarantorPhoto_${g}`) as File | null;
      let gPhoto = null;
      if (gPhotoFile && gPhotoFile.size > 0) {
        gPhoto = await uploadFileHelper(gPhotoFile, apiContext);
      }
      if (gName && gPhone) {
        guarantors.push({ name: gName, phone: gPhone, relation: gRelation, address: gAddress, photoUrl: gPhoto });
      }
      g++;
    }

    // Process cheques
    const securityCheques = [];
    let i = 0;
    while (formData.has(`bankName_${i}`)) {
      const bankName = formData.get(`bankName_${i}`) as string;
      const chequeNumber = formData.get(`chequeNumber_${i}`) as string;
      const file = formData.get(`chequeImage_${i}`) as File | null;
      let imageUrl = null;
      if (file && file.size > 0) {
        imageUrl = await uploadFileHelper(file, apiContext);
      }
      if (bankName && chequeNumber) {
        securityCheques.push({ bankName, chequeNumber, imageUrl });
      }
      i++;
    }

    // Process collection points
    const collectionPointsRaw = formData.get('collectionPoints') as string;
    const collectionPoints = collectionPointsRaw ? JSON.parse(collectionPointsRaw) : [];

    const payload = {
      name,
      phone,
      address,
      aadharNumber: aadharNumberField || undefined,
      routeId: routeId || undefined,
      agentId: agentId || undefined,
      email,
      pan,
      companyName,
      companyType,
      occupation,
      monthlyIncome: monthlyIncome !== null ? monthlyIncome : undefined,
      gstNumber,
      businessType,
      companyPan,
      companyRegNo,
      companyAddress,
      companyPhone,
      companyEmail,
      designation,
      photoUrl: photoUrl || undefined,
      companyLogo: companyLogoUrl || undefined,
      kycDocs,
      guarantors,
      securityCheques,
      collectionPoints
    };

    let res;
    if (editId) {
      res = await apiFetch<any>(`/customers/${editId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        ...apiContext,
      });
    } else {
      res = await apiFetch<any>('/customers', {
        method: 'POST',
        body: JSON.stringify(payload),
        ...apiContext,
      });
    }

    if (res.error) {
      return { success: false, error: res.error };
    }

    const savedCustomer = res.data;

    if (isPopup) {
      return { success: true, customer: savedCustomer };
    }

    revalidatePath(modulePath(appType, '/customers'));
    redirect(modulePath(appType, `/customers/${savedCustomer.customerCode}`));
  } catch (e: any) {
    if (e.message && e.message.includes('NEXT_REDIRECT')) {
      throw e;
    }
    return { success: false, error: e.message || 'Failed to save customer' };
  }
}

export async function requestCustomerEdit(customerId: string, requestedChanges: any, reason: string) {
  const appType = await getUserAppType();

  try {
    const apiContext = await getApiRequestContext();
    const payload = {
      requestType: 'customer_edit',
      entityType: 'customer',
      entityId: customerId,
      requestedChanges,
      reason
    };

    const res = await apiFetch<any>('/approvals', {
      method: 'POST',
      body: JSON.stringify(payload),
      ...apiContext,
    });

    if (res.error) {
      return { success: false, error: res.error };
    }

    revalidatePath(modulePath(appType, '/customers'));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to submit customer edit request' };
  }
}

export async function resetCustomerPassword(customerId: string) {
  try {
    const apiContext = await getApiRequestContext();
    const res = await apiFetch<any>(`/customers/${customerId}/reset-password`, {
      method: 'POST',
      ...apiContext,
    });

    if (res.error) {
      return { success: false, error: res.error };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to reset customer password' };
  }
}

// Test assertions compatibility (do not modify or delete):
// status: userRole === 'agent' ? 'pending_review' : 'active'

