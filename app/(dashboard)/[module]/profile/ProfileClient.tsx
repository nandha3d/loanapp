'use client';

import { useMemo, useState, useTransition } from 'react';
import type { SuperadminProfile } from '@/lib/profile';
import {
  changeProfilePasswordAction,
  sendProfilePasswordOtpAction,
  updateProfileAction,
} from './actions';

type ActionMessage = { type: 'success' | 'error'; text: string } | null;

function formatDate(value: string | null | undefined) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function statusBadge(status: string | null | undefined) {
  const safe = status || 'unknown';
  const cls = safe === 'active' || safe === 'paid' ? 'badge-active' : safe === 'pending' ? 'badge-pending' : 'badge-closed';
  return <span className={`badge ${cls}`} style={{ textTransform: 'capitalize' }}>{safe}</span>;
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'SA';
}

export default function ProfileClient({ initialProfile }: { initialProfile: SuperadminProfile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [message, setMessage] = useState<ActionMessage>(null);
  const [passwordMessage, setPasswordMessage] = useState<ActionMessage>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isPasswordPending, startPasswordTransition] = useTransition();

  const enabledAddOns = useMemo(
    () => profile.subscription?.addOns.filter((addon) => addon.enabled) ?? [],
    [profile.subscription],
  );
  const lockedAddOns = useMemo(
    () => profile.subscription?.addOns.filter((addon) => !addon.enabled) ?? [],
    [profile.subscription],
  );

  function handleProfileSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateProfileAction(formData);
      if (result.success && result.profile) {
        setProfile(result.profile);
        setMessage({ type: 'success', text: 'Profile updated.' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Could not update profile.' });
      }
    });
  }

  function handleSendOtp() {
    setPasswordMessage(null);
    startPasswordTransition(async () => {
      const result = await sendProfilePasswordOtpAction();
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
      const result = await changeProfilePasswordAction(formData);
      if (result.success) {
        setOtpSent(false);
        setPasswordMessage({ type: 'success', text: 'Password changed successfully.' });
      } else {
        setPasswordMessage({ type: 'error', text: result.error || 'Could not change password.' });
      }
    });
  }

  return (
    <div className="profile-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Superadmin Profile</h1>
          <p className="text-muted">Account security, workspace details, and current subscription.</p>
        </div>
      </div>

      <div className="profile-grid">
        <section className="card profile-summary-card">
          <div className="profile-avatar-large">{initials(profile.account.name)}</div>
          <div>
            <h2>{profile.account.name}</h2>
            <div style={{ marginTop: 6 }}>{statusBadge(profile.account.status)}</div>
            <p>{profile.account.email || 'No email on file'}</p>
            <p className="text-muted">{profile.tenant.name} · {profile.tenant.slug}</p>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h3>Basic Details</h3>
          </div>
          <form action={handleProfileSubmit} className="profile-form">
            <label className="form-label" htmlFor="profile-name">Name</label>
            <input
              id="profile-name"
              name="name"
              className="form-control"
              defaultValue={profile.account.name}
              suppressHydrationWarning
            />

            <label className="form-label" htmlFor="profile-phone">Phone</label>
            <input
              id="profile-phone"
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
                <strong>{profile.account.role}</strong>
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
            Send a one-time code to the profile email, then set a new password.
          </p>
          <button className="btn btn-secondary" type="button" onClick={handleSendOtp} disabled={isPasswordPending}>
            <span className="material-icons-outlined">mail</span>
            {isPasswordPending && !otpSent ? 'Sending...' : 'Send Email OTP'}
          </button>
          {otpSent && (
            <form action={handlePasswordSubmit} className="profile-form" style={{ marginTop: 16 }}>
              <label className="form-label" htmlFor="profile-otp">OTP</label>
              <input id="profile-otp" name="otp" className="form-control" inputMode="numeric" maxLength={6} placeholder="6-digit code" suppressHydrationWarning />
              <label className="form-label" htmlFor="profile-new-password">New Password</label>
              <input id="profile-new-password" name="newPassword" className="form-control" type="password" minLength={8} placeholder="At least 8 characters" suppressHydrationWarning />
              <button className="btn btn-primary" type="submit" disabled={isPasswordPending}>
                <span className="material-icons-outlined">lock_reset</span>
                {isPasswordPending ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          )}
          {passwordMessage && <p className={passwordMessage.type === 'success' ? 'profile-success' : 'profile-error'}>{passwordMessage.text}</p>}
        </section>
      </div>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h3>Workspace & Subscription</h3>
          {statusBadge(profile.subscription?.status)}
        </div>
        <div className="subscription-grid">
          <div className="metric-tile">
            <span>Plan</span>
            <strong>{profile.subscription?.planLabel || 'N/A'}</strong>
            <small>{profile.subscription?.planDescription || profile.subscription?.plan || 'No subscription row'}</small>
          </div>
          <div className="metric-tile">
            <span>Monthly Cost</span>
            <strong>{formatCurrency(profile.subscription?.pricing.totalMonthlyPrice)}</strong>
            <small>Base {formatCurrency(profile.subscription?.pricing.basePlanPrice)} · Add-ons {formatCurrency(profile.subscription?.pricing.addonsPrice)}</small>
          </div>
          <div className="metric-tile">
            <span>Trial / Renewal</span>
            <strong>{formatDate(profile.subscription?.trialEndsAt || profile.subscription?.currentPeriodEnd)}</strong>
            <small>{profile.subscription?.trialEndsAt ? 'Trial end' : 'Current period end'}</small>
          </div>
        </div>

        <div className="usage-grid">
          <div>
            <span>Active Loans</span>
            <strong>{profile.usage.activeLoans.toLocaleString('en-IN')}</strong>
            <small>Limit {profile.usage.limits.activeLoans}</small>
          </div>
          <div>
            <span>Agents</span>
            <strong>{profile.usage.activeAgents.toLocaleString('en-IN')}</strong>
            <small>Limit {profile.usage.limits.agents}</small>
          </div>
          <div>
            <span>Branches</span>
            <strong>{profile.usage.activeBranches.toLocaleString('en-IN')}</strong>
            <small>Limit {profile.usage.limits.branches}</small>
          </div>
        </div>

        <div className="profile-chip-section">
          <h4>Enabled Modules</h4>
          <div className="chip-row">
            {(profile.subscription?.enabledModules.length ? profile.subscription.enabledModules : []).map((module) => (
              <span key={module.key} className="profile-chip active">
                <span className="material-icons-outlined">check_circle</span>
                {module.label}
              </span>
            ))}
            {!profile.subscription?.enabledModules.length && <span className="text-muted">No enabled modules found.</span>}
          </div>
        </div>

        <div className="profile-chip-section">
          <h4>Add-ons</h4>
          <div className="chip-row">
            {enabledAddOns.map((addon) => (
              <span key={addon.key} className="profile-chip active">
                <span className="material-icons-outlined">verified</span>
                {addon.label}
              </span>
            ))}
            {lockedAddOns.map((addon) => (
              <span key={addon.key} className="profile-chip">
                <span className="material-icons-outlined">lock</span>
                {addon.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h3>Recent Invoices</h3>
        </div>
        {profile.invoices.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>No invoices found.</p>
        ) : (
          <div className="invoice-list">
            {profile.invoices.map((invoice) => (
              <div className="invoice-row" key={invoice.id}>
                <div>
                  <strong>{invoice.billingPeriod}</strong>
                  <span>{formatDate(invoice.createdAt)} · Due {formatDate(invoice.dueDate)}</span>
                </div>
                <div>
                  <strong>{formatCurrency(invoice.total || invoice.amount)}</strong>
                  {statusBadge(invoice.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <style>{`
        .profile-grid {
          display: grid;
          grid-template-columns: minmax(240px, .8fr) minmax(300px, 1.1fr) minmax(300px, 1fr);
          gap: 20px;
        }
        .profile-summary-card {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .profile-avatar-large {
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
        .profile-summary-card h2 {
          margin: 0;
          font-size: 1.3rem;
          line-height: 1.2;
        }
        .profile-summary-card p {
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
        .readonly-grid div,
        .metric-tile,
        .usage-grid div {
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 12px;
          background: var(--bg);
          min-width: 0;
        }
        .readonly-grid span,
        .metric-tile span,
        .usage-grid span {
          display: block;
          color: var(--text-light);
          font-size: .72rem;
          text-transform: uppercase;
          font-weight: 700;
          margin-bottom: 5px;
        }
        .readonly-grid strong,
        .metric-tile strong,
        .usage-grid strong {
          display: block;
          overflow-wrap: anywhere;
        }
        .metric-tile small,
        .usage-grid small {
          display: block;
          color: var(--text-secondary);
          margin-top: 6px;
          line-height: 1.35;
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
        .subscription-grid,
        .usage-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        .usage-grid {
          margin-top: 14px;
        }
        .profile-chip-section {
          margin-top: 18px;
        }
        .profile-chip-section h4 {
          margin: 0 0 10px;
          font-size: .92rem;
        }
        .chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .profile-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          color: var(--text-secondary);
          background: var(--surface);
          font-size: .82rem;
          font-weight: 600;
        }
        .profile-chip.active {
          border-color: var(--success);
          color: #166534;
          background: var(--success-bg);
        }
        .profile-chip .material-icons-outlined {
          font-size: 16px;
        }
        .invoice-list {
          display: grid;
          gap: 10px;
        }
        .invoice-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 12px 14px;
          background: var(--bg);
        }
        .invoice-row > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .invoice-row > div:last-child {
          align-items: flex-end;
          flex: 0 0 auto;
        }
        .invoice-row span {
          color: var(--text-secondary);
          font-size: .8rem;
        }
        @media (max-width: 1180px) {
          .profile-grid {
            grid-template-columns: 1fr 1fr;
          }
          .profile-summary-card {
            grid-column: 1 / -1;
          }
        }
        @media (max-width: 760px) {
          .profile-grid,
          .subscription-grid,
          .usage-grid,
          .readonly-grid {
            grid-template-columns: 1fr;
          }
          .profile-summary-card,
          .invoice-row {
            align-items: flex-start;
            flex-direction: column;
          }
          .invoice-row > div:last-child {
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
