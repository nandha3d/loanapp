'use client';

import { useState } from 'react';
import PasswordInput from '@/components/ui/PasswordInput';
import { useRouter } from 'next/navigation';
import { validateEmail } from '@/lib/validation/contact';
import { getSupabaseBrowser, isSupabaseAuthEnabled } from '@/lib/supabase/browser';
import { currentOriginWithBasePath, withBasePath } from '@/lib/public-path';

type Step = 'email' | 'reset' | 'sent';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const supabaseMode = isSupabaseAuthEnabled();
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

    // Supabase path: email a magic-link. Clicking it proves ownership and lands
    // the user on /reset-password (via /auth/callback?intent=reset) to set a new
    // password. We always claim success to avoid email enumeration.
    if (supabaseMode) {
      try {
        await getSupabaseBrowser().auth.signInWithOtp({
          email: ec.value,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: `${currentOriginWithBasePath()}/auth/callback?intent=reset`,
          },
        });
      } catch (err) {
        console.error('[SUPABASE_RESET_SEND]', err);
      }
      setNotice('If that email is registered, a secure reset link is on its way. Check inbox and spam.');
      setStep('sent');
      setLoading(false);
      return;
    }

    // Legacy OTP path.
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
          <img src={withBasePath('/assets/logo.svg')} alt="ZoloFund" />
          <h1>Loan<span>Track</span></h1>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '.85rem', marginBottom: '24px' }}>
          {step === 'email' ? 'Reset your password' : step === 'sent' ? 'Check your email' : 'Enter the code we emailed you'}
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

        {step === 'email' && (
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
              {loading ? 'Sending...' : supabaseMode ? 'Send reset link' : 'Send reset code'}
            </button>
          </form>
        )}

        {step === 'sent' && (
          <p style={{ textAlign: 'center', fontSize: '.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Open the link from <strong>{email}</strong> to choose a new password.
            The link expires shortly for your security.
          </p>
        )}

        {step === 'reset' && (
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
              <PasswordInput
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
              <PasswordInput
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
          <a href={withBasePath('/login')} style={{ color: 'var(--primary)', fontWeight: 600 }}>Back to sign in</a>
        </p>
      </div>
    </div>
  );
}
