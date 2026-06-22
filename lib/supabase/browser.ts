'use client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

// Browser Supabase client (anon public key). Drives the user-facing auth
// handshakes only: Google OAuth redirect + email OTP / magic-link send. The
// resulting Supabase access token is handed to our NextAuth `supabase` provider
// which mints the real app session. Supabase SSR stores the PKCE verifier and
// session in cookies so the OAuth/magic-link redirect can survive the callback.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function isSupabaseAuthEnabled(): boolean {
  return Boolean(url && anonKey);
}

let cached: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error('Supabase browser client not configured (missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)');
  }
  if (!cached) {
    cached = createBrowserClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The /auth/exchange route exchanges the ?code first. This remains
        // disabled so the callback page can surface explicit errors.
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  }
  return cached;
}
