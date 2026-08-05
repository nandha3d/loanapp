'use server';

import { apiFetch } from '@/lib/api-client/index';
import { getApiRequestContext } from '@/lib/api-client/server';
import { revalidatePath } from 'next/cache';
import { submitCollectionEntry, submitLoanCollection, requestCollectionEdit } from '@/app/(dashboard)/[module]/collection/actions';

export { requestCollectionEdit };

export async function markInstalmentPaid(formData: FormData) {
  return submitCollectionEntry(formData);
}

// Record a bank repledge against a gold loan.
export async function recordBankRepledge(loanId: string, data: Record<string, unknown>) {
  try {
    const apiContext = await getApiRequestContext();
    const res = await apiFetch<any>(`/gold/loans/${loanId}/repledge`, {
      method: 'POST',
      body: JSON.stringify(data),
      ...apiContext,
    });
    if (res?.error) return { error: res.error };
    revalidatePath('/loans');
    return { success: true, data: res?.data ?? res };
  } catch (e: any) {
    return { error: e?.message || 'Failed to record repledge' };
  }
}

// Record a gold pledge servicing event (interest / part-payment / redemption)
// via the servicing API, then refresh the loan detail.
export async function recordGoldServicing(
  loanId: string,
  action: 'interest' | 'part' | 'redeem' | 'takeover',
  amount: number,
  paymentMode: string = 'cash',
) {
  try {
    const apiContext = await getApiRequestContext();
    const res = await apiFetch<any>(`/gold/loans/${loanId}/servicing`, {
      method: 'POST',
      body: JSON.stringify({ action, amount, paymentMode }),
      ...apiContext,
    });
    if (res?.error) return { error: res.error };
    revalidatePath('/loans');
    return { success: true, data: res?.data ?? res };
  } catch (e: any) {
    return { error: e?.message || 'Failed to record servicing' };
  }
}

/**
 * Loan-wide collection from the loan page — same engine as the collection page
 * popup: records the amount on the collection-date row for Actual.
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

/**
 * Interest-Only principal servicing. `action` is 'part' (prepay some principal,
 * which re-prices the remaining monthly dues) or 'close' (settle the outstanding
 * principal plus any interest already due and close the loan).
 */
async function serviceInterestOnlyPrincipal(formData: FormData, action: 'part' | 'close') {
  try {
    const apiContext = await getApiRequestContext();
    const loanId = formData.get('loanId') as string;

    const loanRes = await apiFetch<any>(`/loans/${loanId}`, apiContext);
    if (loanRes.error) return { success: false, error: loanRes.error };
    const loanCode = loanRes.data?.loanCode;

    const res = await apiFetch<any>(`/loans/${loanId}/principal`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        // Ignored by the API on 'close' — it always settles the full amount itself
        // so a stale figure in the browser can't under-collect.
        amount: Number(formData.get('amount')) || 0,
        paymentMode: (formData.get('paymentMode') as string) || 'cash',
        remarks: (formData.get('remarks') as string) || '',
      }),
      ...apiContext,
    });

    if (res.error) return { success: false, error: res.error };

    if (loanCode) revalidatePath(`/loans/${loanCode}`);
    revalidatePath('/loans');
    revalidatePath('/dashboard');
    return { success: true, data: res.data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Principal payment failed' };
  }
}

export async function partPayPrincipal(formData: FormData) {
  return serviceInterestOnlyPrincipal(formData, 'part');
}

export async function fullCloseLoan(formData: FormData) {
  return serviceInterestOnlyPrincipal(formData, 'close');
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
