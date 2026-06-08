'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { getSupabaseBrowser, isSupabaseAuthEnabled } from '@/lib/supabase/browser';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get('callbackUrl') || '/';
  const callbackUrl = rawCallbackUrl.startsWith('/') ? rawCallbackUrl : '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const notice = searchParams.get('registerPending')
      ? 'Account created! Check your email and click the activation link before signing in.'
    : searchParams.get('verified')
      ? 'Email verified — you can sign in now.'
    : searchParams.get('reset')
      ? 'Password updated — sign in with your new password.'
    : '';
  const verifyError = searchParams.get('verifyError') || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid credentials. If you just registered, verify your email using the activation link we sent before signing in.');
        setLoading(false);
        return;
      }

      // Fetch the active session to retrieve the user's tenantSlug
      const sessionRes = await fetch('/api/auth/session');
      const session = await sessionRes.json();
      const tenantSlug = session?.user?.tenantSlug;

       const hostname = window.location.hostname;
       const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost';
       const rootHost = rootDomain.split(':')[0];
       const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
       const supportsSubdomains = rootDomain && !rootDomain.includes('localhost');

       // If we are currently on the root domain and the tenant has a slug, redirect to their subdomain (if supported)
       if (tenantSlug && tenantSlug !== 'default' && (hostname === rootHost) && !isLocalhost && supportsSubdomains) {
         const protocol = window.location.protocol;
         const port = window.location.port ? `:${window.location.port}` : '';
         const targetUrl = `${protocol}//${tenantSlug}.${hostname}${port}${callbackUrl === '/' ? '/portal' : callbackUrl}`;
         window.location.href = targetUrl;
       } else {
         router.push(callbackUrl);
         router.refresh();
       }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback?intent=login` },
      });
      if (error) setError(error.message || 'Google sign-in failed.');
    } catch (e: any) {
      setError(e?.message || 'Google sign-in is not configured.');
    }
  };

  const setDemoCredentials = (role: 'admin' | 'agent') => {
    if (role === 'admin') {
      setUsername('admin');
      setPassword('admin123');
    } else {
      setUsername('karthik');
      setPassword('agent123');
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-logo">
          <img src="/assets/logo.svg" alt="LoanTrack" />
          <h1>Loan<span>Track</span></h1>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '.85rem', marginBottom: '28px' }}>
          Micro-Lending Management System
        </p>

        {notice && (
          <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '.82rem' }}>
            {notice}
          </div>
        )}
        {(error || verifyError) && (
          <div className="login-error">
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>error</span>
            {error || verifyError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username / Phone</label>
            <input
              type="text"
              id="username"
              className="form-control"
              placeholder="Enter username or phone"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              className="form-control"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <label className="checkbox-label">
              <input type="checkbox" defaultChecked /> Remember me
            </label>
            <a href="/forgot-password" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '.82rem' }}>
              Forgot password?
            </a>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '.95rem' }}
            disabled={loading}
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>login</span>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {isSupabaseAuthEnabled() && (<>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '18px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>
        <button
          type="button"
          onClick={handleGoogle}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '11px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: '#3c4043', fontWeight: 600, fontSize: '.9rem', cursor: 'pointer' }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continue with Google
        </button>
        </>)}

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
          New to LoanTrack? <a href="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Register Business</a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="login-wrapper">
        <div className="login-card">
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
