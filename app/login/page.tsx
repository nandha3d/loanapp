'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

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
