import { apiFetch } from './index';

export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  phone: string;
  address: string | null;
  aadharNumber: string | null;
  routeId: string | null;
  agentId: string | null;
  status: string;
  profilePhoto: string | null;
  email: string | null;
  pan: string | null;
  occupation: string | null;
  monthlyIncome: number | null;
  companyName: string | null;
  companyType: string | null;
  businessType: string | null;
  gstNumber: string | null;
  companyPan: string | null;
  companyRegNo: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyLogo: string | null;
  designation: string | null;
  activeLoanCount?: number;
  activeLoanPrincipal?: number;
  route?: {
    id: string;
    name: string;
  } | null;
  agent?: {
    id: string;
    name: string;
    phone: string;
  } | null;
  loans?: any[];
  kycDocuments?: any[];
  securityCheques?: any[];
  guarantors?: any[];
  collectionPoints?: any[];
  creditScore?: {
    score: number;
    grade: string;
    activeLoanCount: number;
    activeLoanPrincipal: number;
  };
}

export interface CustomerCreatePayload {
  name: string;
  phone: string;
  address?: string;
  aadharNumber?: string;
  routeId?: string;
  agentId?: string;
  photoUrl?: string;
  kycDocs?: Array<{ type: string; url: string }>;
  email?: string;
  pan?: string;
  occupation?: string;
  monthlyIncome?: number | string;
  companyName?: string;
  companyType?: string;
  businessType?: string;
  gstNumber?: string;
  companyPan?: string;
  companyRegNo?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  designation?: string;
  collectionPoints?: Array<{
    name?: string;
    address?: string;
    latitude?: number | string | null;
    longitude?: number | string | null;
    isPrimary?: boolean;
  }>;
}

export async function getCustomers(
  token: string,
  params?: { q?: string; cursor?: string; limit?: number }
): Promise<{ data: Customer[]; pagination?: any }> {
  const qs = new URLSearchParams(params as any).toString();
  const res = await apiFetch<any>(`/customers${qs ? `?${qs}` : ''}`, { token });
  return { data: res.data, pagination: res.pagination };
}

export async function getCustomerById(token: string, id: string): Promise<Customer> {
  const res = await apiFetch<any>(`/customers/${id}`, { token });
  return res.data;
}

export async function createCustomer(token: string, payload: CustomerCreatePayload): Promise<Customer> {
  const res = await apiFetch<any>('/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
  });
  return res.data;
}

export async function updateCustomer(token: string, id: string, payload: Partial<CustomerCreatePayload>): Promise<Customer> {
  const res = await apiFetch<any>(`/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    token,
  });
  return res.data;
}
