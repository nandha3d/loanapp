import { apiFetch } from './index';

export interface Loan {
  id: string;
  loanCode: string;
  customerId: string;
  branchId: string | null;
  principal: number;
  deduction: number;
  deductionType: string;
  disbursed: number;
  frequency: string;
  dueDay: number | null;
  tenure: number;
  startDate: string;
  endDate: string;
  perInstalment: number;
  penaltyRate: number;
  voucherRef: string | null;
  totalPayable: number;
  totalInstalments: number;
  createdById: string;
  status: string;
  closedAt: string | null;
  customer?: {
    id: string;
    name: string;
    customerCode: string;
    phone: string;
  };
  instalments?: any[];
  securityCheques?: any[];
  guarantorId?: string | null;
  collateralDetails?: string | null;
  loanType?: string;
}

export interface LoanCreatePayload {
  customerId: string;
  principal: number;
  deduction?: number;
  deductionType?: string;
  tenure: number;
  frequency?: string;
  startDate?: string;
  penaltyRate?: number;
  loanType?: string;
  collateralDetails?: string | null;
  voucherRef?: string | null;
  dueDay?: number | null;
  securityCheques?: Array<{
    bankName?: string;
    chequeNumber?: string;
    amount?: number;
    imageUrl?: string;
  }>;
  guarantor?: {
    name?: string;
    phone?: string;
    aadharNumber?: string;
    address?: string;
    relation?: string;
    photoUrl?: string;
  };
}

export async function getLoans(
  token: string,
  params?: { customerId?: string; status?: string; cursor?: string; limit?: number; q?: string; frequency?: string; sort?: string; dir?: string; page?: string }
): Promise<{ data: Loan[]; pagination?: any }> {
  const qs = new URLSearchParams(params as any).toString();
  const res = await apiFetch<any>(`/loans${qs ? `?${qs}` : ''}`, { token });
  return { data: res.data, pagination: res.pagination };
}

export async function getLoanById(token: string, id: string): Promise<Loan> {
  const res = await apiFetch<any>(`/loans/${id}`, { token });
  return res.data;
}

export async function createLoan(token: string, payload: LoanCreatePayload): Promise<Loan> {
  const res = await apiFetch<any>('/loans', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
  });
  return res.data;
}

export async function closeLoan(token: string, id: string, payload: { reason: string }): Promise<any> {
  const res = await apiFetch<any>(`/loans/${id}/close`, {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
  });
  return res.data;
}

export async function precloseLoan(token: string, id: string, payload: { receivedAmount: number; waiveAmount: number; remarks?: string }): Promise<any> {
  const res = await apiFetch<any>(`/loans/${id}/preclose`, {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
  });
  return res.data;
}
