import { apiFetch } from './index';

export interface CollectionEntry {
  id: string;
  tenantId: string;
  collectionId: string;
  customerId: string;
  loanId: string;
  dueAmount: number;
  receivedAmount: number;
  paymentMode: string;
  remarks: string | null;
  agentId: string;
  submittedAt: string;
}

export interface CollectionEntryPayload {
  instalmentId: string;
  receivedAmount: number;
  paymentMode: string;
  remarks?: string;
  latitude?: number;
  longitude?: number;
  gpsAccuracy?: number;
  gpsTimestamp?: string;
  gpsAltitude?: number;
  locationStatus?: string;
  idempotencyKey?: string;
  collectionDate?: string;
}

export async function getTodayCollection(
  token: string,
  params?: { cursor?: string; limit?: number }
): Promise<{ data: any[]; pagination?: any }> {
  const qs = new URLSearchParams(params as any).toString();
  const res = await apiFetch<any>(`/collection/today${qs ? `?${qs}` : ''}`, { token });
  return { data: res.data, pagination: res.pagination };
}

export async function submitCollectionEntry(
  token: string,
  payload: CollectionEntryPayload
): Promise<CollectionEntry> {
  const res = await apiFetch<any>('/collection/entry', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
  });
  return res.data;
}
