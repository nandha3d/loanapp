'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [show2fa, setShow2fa] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const params = new URLSearchParams(window.location.search);
      const rawCallbackUrl = params.get('callbackUrl') || '/';
      const callbackUrl = rawCallbackUrl.startsWith('/') ? rawCallbackUrl : '/';

      await signIn('credentials', {
        username,
        password,
        rememberMe: rememberMe ? 'true' : 'false',
        totpCode,
        redirect: true,
        callbackUrl,
      });
    } catch {
      setError('An unexpected error occurred');
      setLoading(false);
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
              suppressHydrationWarning
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
              suppressHydrationWarning
            />
          </div>

          {show2fa && (
            <div className="form-group" style={{ animation: 'slideDown 0.3s ease-out' }}>
              <label className="form-label" htmlFor="totpCode">2FA Code (Authenticator App)</label>
              <input
                type="text"
                id="totpCode"
                className="form-control"
                placeholder="Enter 6-digit code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                required
                maxLength={6}
                autoComplete="one-time-code"
                autoFocus
              />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)} 
              /> Remember me
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


      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginForm />;
}
