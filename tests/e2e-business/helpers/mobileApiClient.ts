import { routeRequest, type Envelope, type ApiResponse } from './apiClient';
import { APP_TYPE } from './testDb';

export type MobileClient = {
  token: string;
  tenantSlug: string;
  branchId: string | null;
  appType?: string | null;
};

export function mobileRequest<T = unknown>(
  client: MobileClient,
  options: {
    importPath: string;
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    path: string;
    body?: unknown;
    params?: Record<string, string | string[]>;
    headers?: Record<string, string>;
  },
): Promise<ApiResponse<Envelope<T>>> {
  return routeRequest<Envelope<T>>({
    ...options,
    token: client.token,
    tenantSlug: client.tenantSlug,
    branchId: client.branchId,
    appType: client.appType ?? APP_TYPE,
  });
}
