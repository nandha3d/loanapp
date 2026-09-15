'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PasswordInput from '@/components/ui/PasswordInput';
import {
  savePlatformPaymentSettingsAction,
  testPlatformRazorpayConnectionAction,
} from './actions';
import type { PlatformPaymentSettingsMasked } from '@/lib/platformPayment';

type Props = {
  initialSettings: PlatformPaymentSettingsMasked;
};

export default function PaymentSettingsClient({ initialSettings }: Props) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [keyId, setKeyId] = useState(initialSettings.keyId);
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [mode, setMode] = useState<'live' | 'test'>(initialSettings.mode);
  const [mockCheckout, setMockCheckout] = useState(initialSettings.mockCheckout);
  const [subTotalCount, setSubTotalCount] = useState(initialSettings.subTotalCount || 120);

  const [isSaving, startSaveTransition] = useTransition();
  const [isTesting, startTestTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);

  // Automatically update mode based on keyId prefix if user changes key
  const handleKeyIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    setKeyId(val);
    if (val.startsWith('rzp_test_')) {
      setMode('test');
    } else if (val.startsWith('rzp_live_')) {
      setMode('live');
    }
  };

  const handleCopyWebhookUrl = () => {
    const url = `${window.location.origin}/api/webhooks/razorpay`;
    navigator.clipboard.writeText(url);
    setCopiedWebhookUrl(true);
    setTimeout(() => setCopiedWebhookUrl(false), 2500);
  };

  const handleTestConnection = () => {
    setMessage(null);
    startTestTransition(async () => {
      const formData = new FormData();
      formData.set('keyId', keyId);
      formData.set('keySecret', keySecret);
      const res = await testPlatformRazorpayConnectionAction(formData);
      if (res.success) {
        setMessage({ type: 'success', text: res.message });
      } else {
        setMessage({ type: 'error', text: res.message });
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    startSaveTransition(async () => {
      const formData = new FormData();
      formData.set('keyId', keyId);
      formData.set('keySecret', keySecret);
      formData.set('webhookSecret', webhookSecret);
      formData.set('mode', mode);
      formData.set('mockCheckout', mockCheckout ? 'true' : 'false');
      formData.set('subTotalCount', String(subTotalCount));

      const res = await savePlatformPaymentSettingsAction(formData);
      if (res.success) {
        setMessage({ type: 'success', text: res.message || 'Payment settings updated successfully!' });
        setKeySecret('');
        setWebhookSecret('');
        setSettings((prev) => ({
          ...prev,
          keyId,
          keySecretSet: Boolean(keySecret.trim()) || prev.keySecretSet,
          webhookSecretSet: Boolean(webhookSecret.trim()) || prev.webhookSecretSet,
          mode,
          mockCheckout,
          subTotalCount,
          source: 'database',
        }));
        router.refresh();
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to save payment settings.' });
      }
    });
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div className="header-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Link href="/admin/settings" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
            </Link>
            <h1 style={{ margin: 0 }}>Platform Payment Settings</h1>
          </div>
          <p className="text-muted" style={{ margin: 0 }}>
            Configure Razorpay credentials for SaaS subscription billing, recurring payments, and webhooks.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTestConnection}
            disabled={isTesting || (!keyId && !settings.keyId)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
              {isTesting ? 'sync' : 'network_check'}
            </span>
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
      </div>

      {message && (
        <div
          className="card fade-up"
          style={{
            padding: '14px 20px',
            marginBottom: '20px',
            background: message.type === 'success' ? 'var(--success-bg, #f0fdf4)' : 'var(--danger-bg, #fff0f0)',
            border: `1px solid ${message.type === 'success' ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)'}`,
            color: message.type === 'success' ? 'var(--success-text, #166534)' : 'var(--danger-text, #991b1b)',
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

      {/* Gateway Status Banner */}
      <div className="card fade-up" style={{ marginBottom: '24px', padding: '16px 20px', background: 'var(--bg-light, #f8f9fa)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                background: '#0c2340',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#528ff0',
                fontWeight: 800,
                fontSize: '18px',
              }}
            >
              R
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '1rem' }}>Razorpay Payment Gateway</strong>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background: mode === 'live' ? '#dcfce7' : '#fef3c7',
                    color: mode === 'live' ? '#166534' : '#92400e',
                  }}
                >
                  {mode === 'live' ? 'Live Mode' : 'Test Mode'}
                </span>
                {mockCheckout && (
                  <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, background: '#fee2e2', color: '#991b1b' }}>
                    Mock Checkout Active
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Active Configuration Source:{' '}
                <strong>
                  {settings.source === 'database'
                    ? 'Database (Developer Account Settings)'
                    : settings.source === 'environment'
                    ? 'Environment (.env file fallback)'
                    : 'Not Configured'}
                </strong>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span
              style={{
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: settings.keySecretSet ? 'var(--success, #16a34a)' : 'var(--warning, #d97706)',
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                {settings.keySecretSet ? 'verified_user' : 'warning'}
              </span>
              {settings.keySecretSet ? 'API Secret Encrypted & Set' : 'Secret Missing'}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
          {/* Main Credentials Column */}
          <div className="card fade-up">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>vpn_key</span>
                API Credentials
              </h3>
            </div>
            <div style={{ padding: '20px' }}>
              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Razorpay Key ID <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="rzp_live_... or rzp_test_..."
                  value={keyId}
                  onChange={handleKeyIdChange}
                  required={!mockCheckout}
                  style={{ fontFamily: 'monospace', letterSpacing: '0.5px' }}
                />
                <p className="text-muted" style={{ fontSize: '0.76rem', marginTop: '4px' }}>
                  Obtain your Key ID from Razorpay Dashboard &rarr; Settings &rarr; API Keys.
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
                    Razorpay Key Secret <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
                  </label>
                  {settings.keySecretSet && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--success, #16a34a)', fontWeight: 600 }}>
                      Stored safely: &bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;
                    </span>
                  )}
                </div>
                <PasswordInput
                  name="keySecret"
                  className="form-control"
                  placeholder={settings.keySecretSet ? 'Leave blank to keep existing encrypted secret' : 'Enter Razorpay Key Secret'}
                  value={keySecret}
                  onChange={(e) => setKeySecret(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="text-muted" style={{ fontSize: '0.76rem', marginTop: '4px' }}>
                  Secrets are encrypted at rest using AES-256-GCM. Blank value keeps the existing secret.
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
                    Razorpay Webhook Secret
                  </label>
                  {settings.webhookSecretSet && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--success, #16a34a)', fontWeight: 600 }}>
                      Stored safely: &bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;
                    </span>
                  )}
                </div>
                <PasswordInput
                  name="webhookSecret"
                  className="form-control"
                  placeholder={settings.webhookSecretSet ? 'Leave blank to keep existing webhook secret' : 'Enter Webhook Secret configured in Razorpay'}
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="text-muted" style={{ fontSize: '0.76rem', marginTop: '4px' }}>
                  Used to verify HMAC-SHA256 signatures for subscription webhook events.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                  style={{ minWidth: '150px' }}
                >
                  {isSaving ? 'Saving Changes...' : 'Save Payment Settings'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleTestConnection}
                  disabled={isTesting || (!keyId && !settings.keyId)}
                >
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
            </div>
          </div>

          {/* Webhook & Environment Details Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Environment & Mode Card */}
            <div className="card fade-up">
              <div className="card-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>tune</span>
                  Gateway Preferences
                </h3>
              </div>
              <div style={{ padding: '20px' }}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Environment Mode</label>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.88rem' }}>
                      <input
                        type="radio"
                        name="mode"
                        value="live"
                        checked={mode === 'live'}
                        onChange={() => setMode('live')}
                      />
                      Live Production (rzp_live)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.88rem' }}>
                      <input
                        type="radio"
                        name="mode"
                        value="test"
                        checked={mode === 'test'}
                        onChange={() => setMode('test')}
                      />
                      Test Sandbox (rzp_test)
                    </label>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Total Subscription Cycles</label>
                  <input
                    type="number"
                    className="form-control"
                    value={subTotalCount}
                    onChange={(e) => setSubTotalCount(parseInt(e.target.value, 10) || 120)}
                    min={1}
                    max={360}
                  />
                  <p className="text-muted" style={{ fontSize: '0.74rem', marginTop: '4px' }}>
                    Standard billing duration in months (default 120 cycles / 10 years).
                  </p>
                </div>

                <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={mockCheckout}
                      onChange={(e) => setMockCheckout(e.target.checked)}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ fontSize: '0.88rem' }}>Enable Mock Checkout Mode</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Simulates subscription checkout without hitting Razorpay servers. Useful for offline development and local UI testing.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Webhook Endpoint Guide Card */}
            <div className="card fade-up">
              <div className="card-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>webhook</span>
                  Webhook Configuration
                </h3>
              </div>
              <div style={{ padding: '20px' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Add this webhook URL in your Razorpay Dashboard (&rarr; Settings &rarr; Webhooks) to automate recurring renewals and cancellations:
                </p>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    readOnly
                    className="form-control"
                    value={typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/razorpay` : '/api/webhooks/razorpay'}
                    style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: 'var(--bg)' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCopyWebhookUrl}
                    style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                      {copiedWebhookUrl ? 'check' : 'content_copy'}
                    </span>
                    {copiedWebhookUrl ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  <strong>Required Webhook Events:</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    <li><code>subscription.activated</code></li>
                    <li><code>subscription.charged</code></li>
                    <li><code>subscription.halted</code></li>
                    <li><code>subscription.cancelled</code></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
