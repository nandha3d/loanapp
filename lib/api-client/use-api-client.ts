'use client';

import { useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { apiFetch, type ApiFetchOptions } from './index';
import { useApiToken } from './use-api-token';

type ApiSessionUser = {
  tenantSlug?: string | null;
  branchId?: string | null;
};

export function useApiClient() {
  const { token, loading: tokenLoading } = useApiToken();
  const { data: session } = useSession();
  const user = session?.user as ApiSessionUser | undefined;
  const tenantSlug = user?.tenantSlug ?? undefined;
  const branchId = user?.branchId ?? undefined;

  const call = useCallback(
    async <T = unknown>(
      path: string,
      options: Omit<ApiFetchOptions, 'token'> = {},
    ): Promise<T> => {
      if (!token) throw new Error('Not authenticated');
      return apiFetch<T>(path, { ...options, token, tenantSlug, branchId });
    },
    [branchId, tenantSlug, token],
  );

  return { call, tokenLoading };
}
