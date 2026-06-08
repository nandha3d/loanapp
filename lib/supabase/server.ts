import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Server-side Supabase admin client (service-role key). Used ONLY to verify
// Supabase access tokens server-side and to look up identities. Never exposed
// to the browser. Supabase here is an *auth broker* — Google OAuth + email
// ownership proof — NOT the application database (that stays in MySQL/Prisma).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cached: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(url && serviceKey);
}

/** Lazily-constructed admin client. Throws if env is missing. */
export function getSupabaseAdmin(): SupabaseClient {
  if (!url || !serviceKey) {
    throw new Error(
      'Supabase not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    );
  }
  if (!cached) {
    cached = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cached;
}

export type SupabaseIdentity = {
  email: string;
  emailVerified: boolean;
  provider: string | null;
  name: string | null;
  supabaseUserId: string;
};

/**
 * Verifies a Supabase access token against the Supabase Auth API (no local JWT
 * secret handling needed) and returns the proven identity, or null if invalid.
 */
export async function verifySupabaseToken(
  accessToken: string,
): Promise<SupabaseIdentity | null> {
  if (!accessToken) return null;
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.getUser(accessToken);
    if (error || !data?.user?.email) return null;
    const u = data.user;
    return {
      email: u.email!.trim().toLowerCase(),
      emailVerified: Boolean(u.email_confirmed_at || (u as any).confirmed_at),
      provider: (u.app_metadata?.provider as string) || null,
      name:
        (u.user_metadata?.full_name as string) ||
        (u.user_metadata?.name as string) ||
        null,
      supabaseUserId: u.id,
    };
  } catch (e) {
    console.error('[SUPABASE_VERIFY_ERROR]', e);
    return null;
  }
}
