'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Browser Supabase client (anon public key). Drives the user-facing auth
// handshakes only: Google OAuth redirect + email OTP / magic-link send. The
// resulting Supabase access token is handed to our NextAuth `supabase` provider
// which mints the real app session. Sessions are persisted so the token survives
// the OAuth/magic-link redirect back to /auth/callback.

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
    cached = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }
  return cached;
}
