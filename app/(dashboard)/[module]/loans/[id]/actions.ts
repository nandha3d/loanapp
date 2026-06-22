'use server';

import { apiFetch } from '@/lib/api-client/index';
import { getApiRequestContext } from '@/lib/api-client/server';
import { revalidatePath } from 'next/cache';
import { submitCollectionEntry, submitLoanCollection, requestCollectionEdit } from '@/app/(dashboard)/[module]/collection/actions';

export { requestCollectionEdit };

export async function markInstalmentPaid(formData: FormData) {
  return submitCollectionEntry(formData);
}

/**
 * Loan-wide collection from the loan page — same engine as the collection page
 * popup: spreads the amount across open instalments oldest-first, recorded today.
 */
export async function markLoanCollection(formData: FormData) {
  return submitLoanCollection(formData);
}

export async function waiveLoanPenalty(formData: FormData) {
  try {
    const apiContext = await getApiRequestContext();
    const penaltyId = formData.get('penaltyId') as string;
    const waivedAmount = Number(formData.get('waivedAmount'));
    const notes = formData.get('notes') as string || '';
    const loanId = formData.get('loanId') as string;
    const grossPenalty = Number(formData.get('grossPenalty'));

    // Fetch loan details via API to get loanCode
    const loanRes = await apiFetch<any>(`/loans/${loanId}`, apiContext);
    if (loanRes.error) return { success: false, error: loanRes.error };
    const loanCode = loanRes.data?.loanCode;

    let targetPenaltyId = penaltyId;
    if (penaltyId === 'new') {
      const createRes = await apiFetch<any>('/penalties', {
        method: 'POST',
        body: JSON.stringify({ loanId, grossPenalty, notes }),
        ...apiContext,
      });
      if (createRes.error) return { success: false, error: createRes.error };
      targetPenaltyId = createRes.data.id;
    }

    const res = await apiFetch<any>(`/penalties/${targetPenaltyId}/waive`, {
      method: 'POST',
      body: JSON.stringify({ amount: waivedAmount, reason: notes }),
      ...apiContext,
    });

    if (res.error) return { success: false, error: res.error };

    if (loanCode) {
      revalidatePath(`/loans/${loanCode}`);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Waive failed' };
  }
}

export async function settleLoanPenalty(formData: FormData) {
  try {
    const apiContext = await getApiRequestContext();
    const penaltyId = formData.get('penaltyId') as string;
    const settledAmount = Number(formData.get('settledAmount'));
    const notes = formData.get('notes') as string || '';
    const loanId = formData.get('loanId') as string;
    const grossPenalty = Number(formData.get('grossPenalty'));

    // Fetch loan details via API to get loanCode
    const loanRes = await apiFetch<any>(`/loans/${loanId}`, apiContext);
    if (loanRes.error) return { success: false, error: loanRes.error };
    const loanCode = loanRes.data?.loanCode;

    let targetPenaltyId = penaltyId;
    if (penaltyId === 'new') {
      const createRes = await apiFetch<any>('/penalties', {
        method: 'POST',
        body: JSON.stringify({ loanId, grossPenalty, notes }),
        ...apiContext,
      });
      if (createRes.error) return { success: false, error: createRes.error };
      targetPenaltyId = createRes.data.id;
    }

    const res = await apiFetch<any>(`/penalties/${targetPenaltyId}/settle`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'settle', amount: settledAmount, paymentMode: 'cash' }),
      ...apiContext,
    });

    if (res.error) return { success: false, error: res.error };

    if (loanCode) {
      revalidatePath(`/loans/${loanCode}`);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Settle failed' };
  }
}

export async function closeLoan(formData: FormData) {
  try {
    const apiContext = await getApiRequestContext();
    const loanId = formData.get('loanId') as string;

    const loanRes = await apiFetch<any>(`/loans/${loanId}`, apiContext);
    if (loanRes.error) return { success: false, error: loanRes.error };
    const loanCode = loanRes.data?.loanCode;

    const markChequesReturned = formData.get('markChequesReturned') === '1';

    const res = await apiFetch<any>(`/loans/${loanId}/close`, {
      method: 'POST',
      body: JSON.stringify({ markChequesReturned }),
      ...apiContext,
    });

    if (res.error) return { success: false, error: res.error };

    if (loanCode) {
      revalidatePath(`/loans/${loanCode}`);
    }
    revalidatePath('/loans');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Close failed' };
  }
}

export async function renewLoan(formData: FormData) {
  try {
    const apiContext = await getApiRequestContext();
    const loanId = formData.get('loanId') as string;

    const res = await apiFetch<any>(`/loans/${loanId}/renew`, {
      method: 'POST',
      body: JSON.stringify({}),
      ...apiContext,
    });

    if (res.error) return { success: false, error: res.error };

    const newLoanId = res.data?.loanCode;
    if (newLoanId) {
      revalidatePath(`/loans/${newLoanId}`);
    }
    revalidatePath('/loans');
    return { success: true, newLoanId };
  } catch (err: any) {
    return { success: false, error: err.message || 'Renewal failed' };
  }
}

export async function precloseLoanAdmin(formData: FormData) {
  try {
    const apiContext = await getApiRequestContext();
    const loanId = formData.get('loanId') as string;
    const amount = Number(formData.get('amount'));
    const paymentMode = formData.get('paymentMode') as string || 'cash';
    const remarks = formData.get('remarks') as string || '';

    const loanRes = await apiFetch<any>(`/loans/${loanId}`, apiContext);
    if (loanRes.error) return { success: false, error: loanRes.error };
    const loanCode = loanRes.data?.loanCode;

    const res = await apiFetch<any>(`/loans/${loanId}/preclose`, {
      method: 'POST',
      body: JSON.stringify({ amount, paymentMode, remarks }),
      ...apiContext,
    });

    if (res.error) return { success: false, error: res.error };

    if (loanCode) {
      revalidatePath(`/loans/${loanCode}`);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Preclose failed' };
  }
}
