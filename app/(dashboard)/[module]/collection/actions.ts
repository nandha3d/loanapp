'use server';

import { apiFetch } from '@/lib/api-client/index';
import { getApiRequestContext } from '@/lib/api-client/server';
import { getUserAppType } from '@/lib/tenant';
import { modulePath } from '@/types/modules';
import { revalidatePath } from 'next/cache';

async function revalidateCollectionSurfaces() {
  const appType = await getUserAppType();
  revalidatePath('/collection');
  revalidatePath('/dashboard');
  revalidatePath(modulePath(appType, '/collection'));
  revalidatePath(modulePath(appType, '/dashboard'));
}

export async function submitCollectionEntry(formData: FormData) {
  const instalmentId = formData.get('instalmentId') as string;
  const receivedAmount = Number(formData.get('receivedAmount'));
  const paymentMode = (formData.get('paymentMode') as string) || 'cash';
  const remarks = (formData.get('remarks') as string) || null;
  const collectionDate = (formData.get('collectionDate') as string) || undefined;

  // Forward optional GPS parameters
  const latitude = formData.get('lat') ? Number(formData.get('lat')) : undefined;
  const longitude = formData.get('lng') ? Number(formData.get('lng')) : undefined;
  const gpsAccuracy = formData.get('gpsAccuracy') ? Number(formData.get('gpsAccuracy')) : undefined;
  const locationStatus = formData.get('locationStatus') as string || undefined;

  try {
    const apiContext = await getApiRequestContext();
    const payload = {
      instalmentId,
      receivedAmount,
      paymentMode,
      remarks,
      collectionDate,
      latitude,
      longitude,
      gpsAccuracy,
      locationStatus
    };

    const res = await apiFetch<any>('/collection/entry', {
      method: 'POST',
      body: JSON.stringify(payload),
      ...apiContext,
    });

    if (res.error) {
      return { success: false, error: res.error };
    }

    await revalidateCollectionSurfaces();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to submit collection entry' };
  }
}

/**
 * Loan-level collection: one payment spread across the loan's open instalments
 * today-first (today's due → overdue oldest-first → future). The amount is
 * recorded today and each instalment is filled only up to its remaining due.
 */
export async function submitLoanCollection(formData: FormData) {
  const loanId = formData.get('loanId') as string;
  const amount = Number(formData.get('amount'));
  const paymentMode = (formData.get('paymentMode') as string) || 'cash';
  const remarks = (formData.get('remarks') as string) || null;
  const collectionDate = (formData.get('collectionDate') as string) || undefined;

  const latitude = formData.get('gpsLatitude') ? Number(formData.get('gpsLatitude')) : undefined;
  const longitude = formData.get('gpsLongitude') ? Number(formData.get('gpsLongitude')) : undefined;
  const gpsAccuracy = formData.get('gpsAccuracy') ? Number(formData.get('gpsAccuracy')) : undefined;
  const locationStatus = (formData.get('gpsStatus') as string) || undefined;

  try {
    const apiContext = await getApiRequestContext();
    const payload = {
      loanId,
      amount,
      paymentMode,
      remarks,
      collectionDate,
      latitude,
      longitude,
      gpsAccuracy,
      locationStatus,
    };

    const res = await apiFetch<any>('/collection/collect', {
      method: 'POST',
      body: JSON.stringify(payload),
      ...apiContext,
    });

    if (res.error) {
      return { success: false, error: res.error };
    }

    await revalidateCollectionSurfaces();
    return { success: true, data: res.data };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to submit collection' };
  }
}

/**
 * Browser-agent location pings. Agents working from the mobile-browser view
 * (instead of the APK) post their position here while the collection page is
 * open, so they appear on the same Agent Tracking map/log as app users.
 * Proxies to /api/v1/gps/ping with the session's API token.
 */
export async function pingAgentLocation(
  pings: {
    lat: number;
    lng: number;
    accuracyM?: number;
    speedMps?: number;
    capturedAt?: string;
  }[],
) {
  try {
    const apiContext = await getApiRequestContext();
    const res = await apiFetch<any>('/gps/ping', {
      method: 'POST',
      body: JSON.stringify({ pings }),
      ...apiContext,
    });
    if (res.error) return { success: false, error: res.error };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Ping failed' };
  }
}

export async function requestCollectionEdit(formData: FormData) {
  const instalmentId = formData.get('instalmentId') as string;
  const requestedAmount = Number(formData.get('requestedAmount'));
  const reason = (formData.get('reason') as string) || '';

  try {
    const apiContext = await getApiRequestContext();
    const payload = {
      requestType: 'edit_collection',
      entityType: 'instalment',
      entityId: instalmentId,
      requestedChanges: { requestedAmount },
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

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to request collection edit' };
  }
}

export async function requestCashHandover() {
  try {
    const apiContext = await getApiRequestContext();
    const res = await apiFetch<any>('/collection/handover', {
      method: 'POST',
      ...apiContext,
    });

    if (res.error) {
      return { success: false, error: res.error };
    }

    await revalidateCollectionSurfaces();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to request cash handover' };
  }
}

export async function verifyUpiPayment(entryId: string) {
  try {
    const apiContext = await getApiRequestContext();
    const res = await apiFetch<any>('/collection/verify', {
      method: 'POST',
      body: JSON.stringify({ action: 'upi', entryId }),
      ...apiContext,
    });

    if (res.error) {
      return { success: false, error: res.error };
    }

    await revalidateCollectionSurfaces();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to verify UPI payment' };
  }
}

export async function collectAgentCash(routeId: string, agentId: string) {
  try {
    const apiContext = await getApiRequestContext();
    const res = await apiFetch<any>('/collection/verify', {
      method: 'POST',
      body: JSON.stringify({ action: 'collect-cash', routeId, agentId }),
      ...apiContext,
    });

    if (res.error) {
      return { success: false, error: res.error };
    }

    await revalidateCollectionSurfaces();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to collect agent cash' };
  }
}

export async function bulkVerifyUpiPayments(entryIds: string[]) {
  try {
    const apiContext = await getApiRequestContext();
    const res = await apiFetch<any>('/collection/verify', {
      method: 'POST',
      body: JSON.stringify({ action: 'bulk-upi', entryIds }),
      ...apiContext,
    });

    if (res.error) {
      return { success: false, error: res.error };
    }

    await revalidateCollectionSurfaces();
    return { success: true, count: res.data?.count };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to verify UPI payments' };
  }
}
