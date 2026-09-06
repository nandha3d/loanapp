'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateDeveloperCredentials } from './actions';
import PasswordInput from '@/components/ui/PasswordInput';

type Props = {
  user: {
    id: string;
    name: string;
    username: string;
    phone: string;
    email: string | null;
  };
  stats: {
    totalTenants: number;
    totalUsers: number;
    totalLoans: number;
    totalBranches: number;
    totalCustomers: number;
  };
};

export default function SettingsClient({ user, stats }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  return (
    <div>
      <div className="page-header">
        <div className="header-content">
          <h1>Developer Settings</h1>
          <p className="text-muted">Manage your account credentials and view system overview.</p>
        </div>
      </div>

      {message && (
        <div
          className="card fade-up"
          style={{
            padding: '14px 20px',
            marginBottom: '20px',
            background: message.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg, #fff0f0)',
            border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
            color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '20px' }}>
            {message.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {message.text}
        </div>
      )}

      {/* System Overview */}
      <div className="card fade-up" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>monitoring</span>
            System Overview
          </h3>
        </div>
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
            {[
              { label: 'Tenants', value: stats.totalTenants, icon: 'domain', color: '#667eea' },
              { label: 'Users', value: stats.totalUsers, icon: 'people', color: '#764ba2' },
              { label: 'Branches', value: stats.totalBranches, icon: 'store', color: '#f093fb' },
              { label: 'Customers', value: stats.totalCustomers, icon: 'person', color: '#4facfe' },
              { label: 'Loans', value: stats.totalLoans, icon: 'account_balance', color: '#43e97b' },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '20px',
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: `${stat.color}15`,
                  }}
                />
                <span
                  className="material-icons-outlined"
                  style={{ fontSize: '24px', color: stat.color, marginBottom: '8px', display: 'block' }}
                >
                  {stat.icon}
                </span>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
                  {stat.value.toLocaleString()}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-light)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginTop: '6px',
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Account Settings */}
      <div className="card fade-up">
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>manage_accounts</span>
            Account Credentials
          </h3>
        </div>
        <div style={{ padding: '0 20px 20px' }}>
          <form
            action={async (fd) => {
              setLoading(true);
              setMessage(null);
              const res = await updateDeveloperCredentials(fd);
              setLoading(false);
              if (res.success) {
                setMessage({ type: 'success', text: res.message || 'Settings saved!' });
                router.refresh();
              } else {
                setMessage({ type: 'error', text: res.error || 'Failed to save' });
              }
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Left column — Username */}
              <div>
                <div
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '20px',
                  }}
                >
                  <h4 style={{ marginBottom: '16px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '18px' }}>person</span>
                    Login Credentials
                  </h4>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      name="username"
                      className="form-control"
                      defaultValue={user.username}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={user.name}
                      disabled
                      style={{ opacity: 0.6 }}
                    />
                    <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                      Name can be changed from the Edit User modal.
                    </p>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Phone</label>
                    <input
                      type="text"
                      className="form-control"
                      value={user.phone}
                      disabled
                      style={{ opacity: 0.6 }}
                    />
                  </div>
                </div>
              </div>

              {/* Right column — Password */}
              <div>
                <div
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '20px',
                  }}
                >
                  <h4 style={{ marginBottom: '16px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '18px' }}>lock</span>
                    Change Password
                  </h4>
                  <div className="form-group">
                    <label className="form-label">Current Password</label>
                    <PasswordInput
                      name="currentPassword"
                      className="form-control"
                      placeholder="Enter current password"
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <PasswordInput
                      name="newPassword"
                      className="form-control"
                      placeholder="Enter new password"
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Confirm New Password</label>
                    <PasswordInput
                      name="confirmPassword"
                      className="form-control"
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>save</span>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
