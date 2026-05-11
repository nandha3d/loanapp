'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        setError('Invalid username or password');
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
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

        {error && (
          <div className="login-error">
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>error</span>
            {error}
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

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: '.78rem', color: 'var(--text-light)', marginBottom: '10px' }}>Demo Login Credentials</p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setDemoCredentials('admin')}>
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>admin_panel_settings</span> Admin
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setDemoCredentials('agent')}>
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>person</span> Agent
            </button>
          </div>
        </div>
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
