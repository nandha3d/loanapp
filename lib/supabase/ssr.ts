import 'server-only';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

export function isSupabaseSsrConfigured(): boolean {
  return Boolean(url && anonKey);
}

export async function getSupabaseSsr(): Promise<{
  supabase: SupabaseClient;
  responseHeaders: Record<string, string>;
}> {
  if (!url || !anonKey) {
    throw new Error('Supabase SSR client not configured (missing SUPABASE URL / ANON KEY)');
  }

  const cookieStore = await cookies();
  const responseHeaders: Record<string, string> = {};

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options as CookieOptions);
        }
        Object.assign(responseHeaders, headers);
      },
    },
  });

  return { supabase, responseHeaders };
}
