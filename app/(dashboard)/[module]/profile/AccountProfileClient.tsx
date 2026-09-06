'use client';

import { useState, useTransition } from 'react';
import type { GenericAccountProfile } from '@/lib/genericProfile';
import {
  changeAccountPasswordAction,
  sendAccountPasswordOtpAction,
  updateAccountProfileAction,
} from './genericActions';

type ActionMessage = { type: 'success' | 'error'; text: string } | null;

function formatDate(value: string | null | undefined) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'U';
}

function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function AccountProfileClient({ initialProfile }: { initialProfile: GenericAccountProfile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [editingName, setEditingName] = useState(false);
  const [message, setMessage] = useState<ActionMessage>(null);
  const [passwordMessage, setPasswordMessage] = useState<ActionMessage>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isPasswordPending, startPasswordTransition] = useTransition();

  function handleProfileSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateAccountProfileAction(formData);
      if (result.success && result.profile) {
        setProfile(result.profile);
        setEditingName(false);
        setMessage({ type: 'success', text: 'Profile updated.' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Could not update profile.' });
      }
    });
  }

  function handleSendOtp() {
    setPasswordMessage(null);
    startPasswordTransition(async () => {
      const result = await sendAccountPasswordOtpAction();
      if (result.success) {
        setOtpSent(true);
        setPasswordMessage({ type: 'success', text: 'OTP sent to your account email.' });
      } else {
        setPasswordMessage({ type: 'error', text: result.error || 'Could not send OTP.' });
      }
    });
  }

  function handlePasswordSubmit(formData: FormData) {
    setPasswordMessage(null);
    startPasswordTransition(async () => {
      const result = await changeAccountPasswordAction(formData);
      if (result.success) {
        setOtpSent(false);
        setPasswordMessage({ type: 'success', text: 'Password changed successfully.' });
      } else {
        setPasswordMessage({ type: 'error', text: result.error || 'Could not change password.' });
      }
    });
  }

  return (
    <div className="account-profile-page">
      <div className="page-header">
        <div className="header-content">
          <h1>My Profile</h1>
          <p className="text-muted">Your account details and password.</p>
        </div>
      </div>

      <div className="account-profile-grid">
        <section className="card account-summary-card">
          <div className="account-avatar-large">{initials(profile.account.name)}</div>
          <div style={{ minWidth: 0 }}>
            {editingName ? (
              <form action={handleProfileSubmit} className="inline-name-form">
                <input
                  name="name"
                  className="form-control"
                  defaultValue={profile.account.name}
                  autoFocus
                  suppressHydrationWarning
                />
                <input type="hidden" name="phone" value={profile.account.phone} />
                <div className="inline-name-actions">
                  <button className="btn btn-primary btn-sm" type="submit" disabled={isPending}>
                    {isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => setEditingName(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <h2>
                {profile.account.name}
                <button
                  type="button"
                  className="edit-name-btn"
                  title="Edit name"
                  aria-label="Edit name"
                  onClick={() => setEditingName(true)}
                >
                  <span className="material-icons-outlined">edit</span>
                </button>
              </h2>
            )}
            <p className="text-muted">{roleLabel(profile.account.role)} · {profile.account.branchName || 'No branch'}</p>
            <p>{profile.account.email || 'No email on file'}</p>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h3>Basic Details</h3>
          </div>
          <form action={handleProfileSubmit} className="profile-form">
            <label className="form-label" htmlFor="account-name">Name</label>
            <input
              id="account-name"
              name="name"
              className="form-control"
              defaultValue={profile.account.name}
              suppressHydrationWarning
            />

            <label className="form-label" htmlFor="account-phone">Phone</label>
            <input
              id="account-phone"
              name="phone"
              className="form-control"
              defaultValue={profile.account.phone}
              suppressHydrationWarning
            />

            <div className="readonly-grid">
              <div>
                <span>Email</span>
                <strong>{profile.account.email || 'N/A'}</strong>
              </div>
              <div>
                <span>Username</span>
                <strong>{profile.account.username}</strong>
              </div>
              <div>
                <span>Role</span>
                <strong>{roleLabel(profile.account.role)}</strong>
              </div>
              <div>
                <span>Last Login</span>
                <strong>{formatDate(profile.account.lastLoginAt)}</strong>
              </div>
            </div>

            {message && <p className={message.type === 'success' ? 'profile-success' : 'profile-error'}>{message.text}</p>}
            <button className="btn btn-primary" type="submit" disabled={isPending}>
              <span className="material-icons-outlined">save</span>
              {isPending ? 'Saving...' : 'Save Details'}
            </button>
          </form>
        </section>

        <section className="card">
          <div className="card-header">
            <h3>Password Change</h3>
          </div>
          <p className="text-muted" style={{ marginBottom: 14 }}>
            Send a one-time code to your account email, then set a new password.
          </p>
          <button className="btn btn-secondary" type="button" onClick={handleSendOtp} disabled={isPasswordPending}>
            <span className="material-icons-outlined">mail</span>
            {isPasswordPending && !otpSent ? 'Sending...' : 'Send Email OTP'}
          </button>
          {otpSent && (
            <form action={handlePasswordSubmit} className="profile-form" style={{ marginTop: 16 }}>
              <label className="form-label" htmlFor="account-otp">OTP</label>
              <input id="account-otp" name="otp" className="form-control" inputMode="numeric" maxLength={6} placeholder="6-digit code" suppressHydrationWarning />
              <label className="form-label" htmlFor="account-new-password">New Password</label>
              <input id="account-new-password" name="newPassword" className="form-control" type="password" minLength={8} placeholder="At least 8 characters" suppressHydrationWarning />
              <button className="btn btn-primary" type="submit" disabled={isPasswordPending}>
                <span className="material-icons-outlined">lock_reset</span>
                {isPasswordPending ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          )}
          {passwordMessage && <p className={passwordMessage.type === 'success' ? 'profile-success' : 'profile-error'}>{passwordMessage.text}</p>}
        </section>
      </div>

      <style>{`
        .account-profile-grid {
          display: grid;
          grid-template-columns: minmax(240px, .8fr) minmax(300px, 1.1fr) minmax(300px, 1fr);
          gap: 20px;
        }
        .account-summary-card {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .account-avatar-large {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          background: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.25rem;
          flex: 0 0 auto;
        }
        .account-summary-card h2 {
          margin: 0;
          font-size: 1.3rem;
          line-height: 1.2;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .edit-name-btn {
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 2px;
          display: inline-flex;
          color: var(--text-light);
          border-radius: 6px;
        }
        .edit-name-btn:hover {
          color: var(--primary);
          background: var(--bg);
        }
        .edit-name-btn .material-icons-outlined {
          font-size: 16px;
        }
        .inline-name-form {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .inline-name-actions {
          display: flex;
          gap: 8px;
        }
        .account-summary-card p {
          margin: 8px 0 0;
          overflow-wrap: anywhere;
        }
        .profile-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .readonly-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin: 4px 0;
        }
        .readonly-grid div {
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 12px;
          background: var(--bg);
          min-width: 0;
        }
        .readonly-grid span {
          display: block;
          color: var(--text-light);
          font-size: .72rem;
          text-transform: uppercase;
          font-weight: 700;
          margin-bottom: 5px;
        }
        .readonly-grid strong {
          display: block;
          overflow-wrap: anywhere;
        }
        .profile-success {
          margin: 0;
          color: var(--success);
          font-size: .85rem;
          font-weight: 600;
        }
        .profile-error {
          margin: 0;
          color: var(--danger);
          font-size: .85rem;
          font-weight: 600;
        }
        @media (max-width: 1180px) {
          .account-profile-grid {
            grid-template-columns: 1fr 1fr;
          }
          .account-summary-card {
            grid-column: 1 / -1;
          }
        }
        @media (max-width: 760px) {
          .account-profile-grid,
          .readonly-grid {
            grid-template-columns: 1fr;
          }
          .account-summary-card {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
