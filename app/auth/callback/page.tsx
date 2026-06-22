'use client';

import { Suspense, useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

// Landing point after /auth/exchange finishes the Supabase PKCE code exchange.
// Supabase has already established a cookie-backed browser session here; we
// read its access token, then bridge into the app's NextAuth session.
//
//   intent=login  (default) → Google sign-in. Existing user → portal;
//                              new user → /register prefilled.
//   intent=verify          → email-confirmation link for a pending signup.
//   intent=reset           → forgot-password link → /reset-password.
function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const intent = params.get('intent') || 'login';
  const [message, setMessage] = useState('Finishing sign-in…');

  useEffect(() => {
    let cancelled = false;

    const bail = (msg: string) =>
      router.replace('/login?verifyError=' + encodeURIComponent(msg));

    (async () => {
      const supabase = getSupabaseBrowser();
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''));

      // Provider-side failure (consent denied, mismatch, etc.) comes back as
      // ?error=...&error_description=... — surface it verbatim.
      const provErr = url.searchParams.get('error_description') || hash.get('error_description');
      if (provErr) { if (!cancelled) bail(provErr); return; }

      // The normal PKCE path is exchanged in /auth/exchange. Keep a hash
      // fallback for older magic links that may still include #access_token.
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token ?? hash.get('access_token') ?? null;

      if (cancelled) return;
      if (!accessToken) {
        bail('Sign-in link expired or invalid. Try again.');
        return;
      }

      // Does an app account already exist for this verified email?
      const pre = await fetch('/api/auth/supabase-precheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken }),
      }).then((r) => r.json()).catch(() => null);

      if (cancelled) return;

      if (!pre?.ok) {
        router.replace('/login?verifyError=' + encodeURIComponent('Could not verify your sign-in. Try again.'));
        return;
      }

      if (!pre.exists) {
        // New Google user → onboard via registration, prefilled.
        const qs = new URLSearchParams({
          google_email: pre.email || '',
          google_name: pre.name || '',
        });
        router.replace(`/register?${qs.toString()}`);
        return;
      }

      if (pre.tenantActive === false) {
        router.replace('/login?verifyError=' + encodeURIComponent('Your organization account is inactive.'));
        return;
      }

      setMessage('Signing you in…');

      if (intent === 'reset') {
        const res = await signIn('supabase', { access_token: accessToken, redirect: false });
        if (cancelled) return;
        if (res?.error) {
          router.replace('/login?verifyError=' + encodeURIComponent('Reset link could not be verified.'));
          return;
        }
        router.replace('/reset-password');
        return;
      }

      // login + verify both end in an authenticated session.
      await signIn('supabase', {
        access_token: accessToken,
        redirect: true,
        callbackUrl: '/portal',
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [intent, router]);

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          {message}
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="login-wrapper"><div className="login-card"><div style={{ textAlign: 'center', padding: '40px' }}>Loading…</div></div></div>
    }>
      <CallbackInner />
    </Suspense>
  );
}
