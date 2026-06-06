'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { validateEmail } from '@/lib/validation/contact';

type Step = 'email' | 'reset';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const ec = validateEmail(email);
    if (!ec.ok) { setError(ec.error); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ec.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        setError(data?.error || 'Could not send reset code');
        setLoading(false);
        return;
      }
      // Always advance — server returns success regardless to avoid email enumeration.
      setEmail(ec.value);
      setNotice('If that email is registered, a 6-digit code is on its way. Check inbox and spam.');
      setStep('reset');
    } catch {
      setError('Network error. Try again.');
    }
    setLoading(false);
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(otp.trim())) { setError('Enter the 6-digit code from your email'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otp.trim(), newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        setError(data?.error || 'Reset failed');
        setLoading(false);
        return;
      }
      router.push('/login?reset=1');
    } catch {
      setError('Network error. Try again.');
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
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '.85rem', marginBottom: '24px' }}>
          {step === 'email' ? 'Reset your password' : 'Enter the code we emailed you'}
        </p>

        {notice && (
          <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '.82rem' }}>
            {notice}
          </div>
        )}
        {error && (
          <div className="login-error">
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>error</span>
            {error}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={requestCode}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Account email</label>
              <input
                type="email"
                id="email"
                className="form-control"
                placeholder="you@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={loading}>
              {loading ? 'Sending...' : 'Send reset code'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitReset}>
            <div className="form-group">
              <label className="form-label" htmlFor="otp">6-digit code</label>
              <input
                type="text"
                id="otp"
                inputMode="numeric"
                maxLength={6}
                className="form-control"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="newPassword">New password</label>
              <input
                type="password"
                id="newPassword"
                className="form-control"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="confirm">Confirm password</label>
              <input
                type="password"
                id="confirm"
                className="form-control"
                placeholder="Re-enter password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={loading}>
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
          <a href="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Back to sign in</a>
        </p>
      </div>
    </div>
  );
}
