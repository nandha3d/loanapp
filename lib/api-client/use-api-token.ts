'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface TokenState {
  token: string | null;
  loading: boolean;
  error: string | null;
}

let cachedToken: string | null = null;
let fetchPromise: Promise<string> | null = null;

async function fetchToken(): Promise<string> {
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch('/api/auth/v1-token', { credentials: 'include' })
    .then(async (res) => {
      if (res.status === 401) throw new Error('UNAUTHORIZED');
      if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
      const { token } = await res.json();
      cachedToken = token;
      return token as string;
    })
    .finally(() => {
      fetchPromise = null;
    });

  return fetchPromise;
}

export function useApiToken(): TokenState & { refetch: () => void } {
  const router = useRouter();
  const [state, setState] = useState<TokenState>({
    token: cachedToken,
    loading: !cachedToken,
    error: null,
  });

  const load = useCallback(async () => {
    if (cachedToken) {
      setState({ token: cachedToken, loading: false, error: null });
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const token = await fetchToken();
      setState({ token, loading: false, error: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch API token';
      if (message === 'UNAUTHORIZED') {
        router.push('/login');
        return;
      }
      setState({ token: null, loading: false, error: message });
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  return { ...state, refetch: load };
}

export function clearTokenCache() {
  cachedToken = null;
  fetchPromise = null;
}
