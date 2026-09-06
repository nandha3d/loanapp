'use client';

import { useState } from 'react';
import PasswordInput from '@/components/ui/PasswordInput';
import { useRouter } from 'next/navigation';
import { withBasePath } from '@/lib/public-path';

// Reached after a Supabase reset magic-link verifies email ownership and the
// /auth/callback bridge establishes an authenticated session. The user simply
// sets a new password, which is written to MySQL (the password store of record).
export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        setError(data?.error || 'Could not update password. Open the reset link again.');
        setLoading(false);
        return;
      }
      router.push('/portal');
      router.refresh();
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
          Choose a new password
        </p>

        {error && (
          <div className="login-error">
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>error</span>
            {error}
          </div>
        )}

        <form onSubmit={submit}>
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
      </div>
    </div>
  );
}
