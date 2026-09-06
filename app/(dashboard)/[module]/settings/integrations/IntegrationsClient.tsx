'use client';

import { useState, useTransition } from 'react';
import { saveIntegrationsAction } from './actions';
import type { IntegrationSettings } from '@/lib/integrations/settings';

type Props = {
  initial: IntegrationSettings;
  paymentGatewayUrl: string;
  nachWebhookUrl: string;
  collectionsWebhookUrl: string;
};

export default function IntegrationsClient({
  initial,
  paymentGatewayUrl,
  nachWebhookUrl,
  collectionsWebhookUrl,
}: Props) {
  const [settings, setSettings] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function save(section: string, payload: Record<string, any>) {
    setMessage(null);
    startTransition(async () => {
      const res = await saveIntegrationsAction({ [section]: payload });
      if (res.success && res.data) {
        setSettings(res.data);
        setMessage({ ok: true, text: 'Integration settings saved.' });
      } else {
        setMessage({ ok: false, text: res.error ?? 'Failed to save integrations.' });
      }
    });
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 980 }}>
      <div className="card" style={{ padding: 20 }}>
        <div className="card-header" style={{ marginBottom: 8 }}>
          <div>
            <h2 style={{ margin: 0 }}>Add-on Integrations</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
              Connect tenant-owned third-party accounts for auto-debit, notifications, KYC, and bureau checks.
            </p>
          </div>
          <StatusBadge active={settings.razorpay.ready} label={settings.razorpay.ready ? 'Razorpay ready' : 'Razorpay pending'} />
        </div>
        {message && (
          <p style={{ margin: '8px 0 0', color: message.ok ? 'var(--success)' : 'var(--danger)', fontSize: 13 }}>
            {message.text}
          </p>
        )}
      </div>

      <section className="card" style={{ padding: 20 }}>
        <div className="card-header">
          <div>
            <h3 style={{ margin: 0 }}>e-NACH Auto-Debit</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
              Uses the same Razorpay keys configured for payment links. These settings control mandate registration and retry timing.
            </p>
          </div>
          <StatusBadge active={settings.nach.enabled && settings.razorpay.ready} label={settings.nach.enabled ? 'Enabled' : 'Disabled'} />
        </div>
        <form
          style={{ display: 'grid', gap: 12, marginTop: 16 }}
          action={(fd) => save('nach', {
            enabled: fd.get('enabled') === 'true',
            maxRetries: fd.get('maxRetries'),
            retryIntervalDays: fd.get('retryIntervalDays'),
            presentDaysBefore: fd.get('presentDaysBefore'),
            defaultMaxAmount: fd.get('defaultMaxAmount'),
            authType: fd.get('authType'),
          })}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" name="enabled" value="true" defaultChecked={settings.nach.enabled} />
            <span>Enable e-NACH mandate registration and scheduled presentation</span>
          </label>
          <div className="form-row">
            <Field label="Default max debit amount">
              <input className="form-control" name="defaultMaxAmount" type="number" min="0" defaultValue={settings.nach.defaultMaxAmount || ''} />
            </Field>
            <Field label="Auth type">
              <select className="form-control" name="authType" defaultValue={settings.nach.authType}>
                <option value="netbanking">Net banking</option>
                <option value="debitcard">Debit card</option>
                <option value="aadhaar">Aadhaar</option>
              </select>
            </Field>
          </div>
          <div className="form-row">
            <Field label="Present debit before due date">
              <input className="form-control" name="presentDaysBefore" type="number" min="1" defaultValue={settings.nach.presentDaysBefore} />
            </Field>
            <Field label="Retry interval days">
              <input className="form-control" name="retryIntervalDays" type="number" min="1" defaultValue={settings.nach.retryIntervalDays} />
            </Field>
            <Field label="Max retries">
              <input className="form-control" name="maxRetries" type="number" min="1" defaultValue={settings.nach.maxRetries} />
            </Field>
          </div>
          <Webhook label="NACH webhook" value={nachWebhookUrl} />
          {!settings.razorpay.ready && (
            <p style={{ margin: 0, color: 'var(--warning)', fontSize: 13 }}>
              Add Razorpay Key ID and Secret in Payment Gateway before enabling live mandates.
            </p>
          )}
          <button className="btn btn-primary" disabled={pending} type="submit">Save NACH</button>
        </form>
      </section>

      <section className="card" style={{ padding: 20 }}>
        <div className="card-header">
          <div>
            <h3 style={{ margin: 0 }}>Razorpay Payment Gateway</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
              Payment links and e-NACH both use this tenant Razorpay account.
            </p>
          </div>
          <a className="btn btn-secondary btn-sm" href={paymentGatewayUrl}>Open gateway setup</a>
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 12, fontSize: 14 }}>
          <Row label="Key ID" value={settings.razorpay.keyId || 'Not set'} />
          <Row label="Key Secret" value={settings.razorpay.keySecretSet ? 'Saved' : 'Missing'} />
          <Row label="Webhook Secret" value={settings.razorpay.webhookSecretSet ? 'Saved' : 'Missing'} />
          <Webhook label="Collections webhook" value={collectionsWebhookUrl} />
        </div>
      </section>

      <section className="card" style={{ padding: 20 }}>
        <div className="card-header">
          <h3 style={{ margin: 0 }}>MSG91 SMS and WhatsApp</h3>
          <StatusBadge active={settings.messaging.enabled && settings.messaging.msg91AuthKeySet} label={settings.messaging.msg91AuthKeySet ? 'Connected' : 'Needs key'} />
        </div>
        <form
          style={{ display: 'grid', gap: 12, marginTop: 16 }}
          action={(fd) => save('messaging', {
            enabled: fd.get('enabled') === 'true',
            smsEnabled: fd.get('smsEnabled') === 'true',
            whatsappEnabled: fd.get('whatsappEnabled') === 'true',
            senderId: fd.get('senderId'),
            whatsappNumber: fd.get('whatsappNumber'),
            msg91AuthKey: fd.get('msg91AuthKey'),
          })}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" name="enabled" value="true" defaultChecked={settings.messaging.enabled} />
            <span>Enable outbound notifications</span>
          </label>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <label><input type="checkbox" name="smsEnabled" value="true" defaultChecked={settings.messaging.smsEnabled} /> SMS</label>
            <label><input type="checkbox" name="whatsappEnabled" value="true" defaultChecked={settings.messaging.whatsappEnabled} /> WhatsApp</label>
          </div>
          <div className="form-row">
            <Field label="Sender ID">
              <input className="form-control" name="senderId" defaultValue={settings.messaging.senderId} />
            </Field>
            <Field label="WhatsApp number">
              <input className="form-control" name="whatsappNumber" defaultValue={settings.messaging.whatsappNumber} />
            </Field>
          </div>
          <Field label={`MSG91 Auth Key ${settings.messaging.msg91AuthKeySet ? '- saved, leave blank to keep' : ''}`}>
            <input className="form-control" name="msg91AuthKey" type="password" autoComplete="new-password" placeholder={settings.messaging.msg91AuthKeySet ? 'Saved' : 'MSG91 auth key'} />
          </Field>
          <button className="btn btn-primary" disabled={pending} type="submit">Save MSG91</button>
        </form>
      </section>

      <section className="card" style={{ padding: 20 }}>
        <div className="card-header">
          <h3 style={{ margin: 0 }}>SMTP Email</h3>
          <StatusBadge active={settings.email.enabled && settings.email.smtpPassSet} label={settings.email.smtpPassSet ? 'Configured' : 'Needs password'} />
        </div>
        <form
          style={{ display: 'grid', gap: 12, marginTop: 16 }}
          action={(fd) => save('email', {
            enabled: fd.get('enabled') === 'true',
            smtpHost: fd.get('smtpHost'),
            smtpPort: fd.get('smtpPort'),
            smtpUser: fd.get('smtpUser'),
            smtpPass: fd.get('smtpPass'),
            fromName: fd.get('fromName'),
          })}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" name="enabled" value="true" defaultChecked={settings.email.enabled} />
            <span>Enable email notifications</span>
          </label>
          <div className="form-row">
            <Field label="SMTP host"><input className="form-control" name="smtpHost" defaultValue={settings.email.smtpHost} /></Field>
            <Field label="Port"><input className="form-control" name="smtpPort" defaultValue={settings.email.smtpPort} /></Field>
          </div>
          <div className="form-row">
            <Field label="SMTP user"><input className="form-control" name="smtpUser" defaultValue={settings.email.smtpUser} /></Field>
            <Field label="From name"><input className="form-control" name="fromName" defaultValue={settings.email.fromName} /></Field>
          </div>
          <Field label={`SMTP password ${settings.email.smtpPassSet ? '- saved, leave blank to keep' : ''}`}>
            <input className="form-control" name="smtpPass" type="password" autoComplete="new-password" placeholder={settings.email.smtpPassSet ? 'Saved' : 'SMTP password'} />
          </Field>
          <button className="btn btn-primary" disabled={pending} type="submit">Save SMTP</button>
        </form>
      </section>

      <section className="card" style={{ padding: 20 }}>
        <div className="card-header">
          <h3 style={{ margin: 0 }}>Digio KYC</h3>
          <StatusBadge active={settings.kyc.enabled && settings.kyc.clientSecretSet} label={settings.kyc.clientSecretSet ? 'Connected' : 'Needs secret'} />
        </div>
        <form
          style={{ display: 'grid', gap: 12, marginTop: 16 }}
          action={(fd) => save('kyc', {
            enabled: fd.get('enabled') === 'true',
            environment: fd.get('environment'),
            clientId: fd.get('clientId'),
            clientSecret: fd.get('clientSecret'),
            webhookSecret: fd.get('webhookSecret'),
          })}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" name="enabled" value="true" defaultChecked={settings.kyc.enabled} />
            <span>Enable Digio KYC connector</span>
          </label>
          <div className="form-row">
            <Field label="Environment">
              <select className="form-control" name="environment" defaultValue={settings.kyc.environment}>
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </Field>
            <Field label="Client ID">
              <input className="form-control" name="clientId" defaultValue={settings.kyc.clientId} />
            </Field>
          </div>
          <Field label={`Client secret ${settings.kyc.clientSecretSet ? '- saved, leave blank to keep' : ''}`}>
            <input className="form-control" name="clientSecret" type="password" autoComplete="new-password" placeholder={settings.kyc.clientSecretSet ? 'Saved' : 'Client secret'} />
          </Field>
          <Field label={`Webhook secret ${settings.kyc.webhookSecretSet ? '- saved, leave blank to keep' : ''}`}>
            <input className="form-control" name="webhookSecret" type="password" autoComplete="new-password" placeholder={settings.kyc.webhookSecretSet ? 'Saved' : 'Webhook secret'} />
          </Field>
          <button className="btn btn-primary" disabled={pending} type="submit">Save Digio</button>
        </form>
      </section>

      <section className="card" style={{ padding: 20 }}>
        <div className="card-header">
          <h3 style={{ margin: 0 }}>Credit Bureau</h3>
          <StatusBadge active={settings.bureau.enabled && settings.bureau.apiKeySet} label={settings.bureau.enabled ? 'Enabled' : 'Disabled'} />
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '8px 0 12px' }}>
          Advanced certificate upload remains in the Bureau Connect settings tab. Use this status card to confirm API credentials are present.
        </p>
        <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
          <Row label="Provider" value={settings.bureau.provider} />
          <Row label="Environment" value={settings.bureau.environment} />
          <Row label="Member ID" value={settings.bureau.memberIdSet ? 'Saved' : 'Missing'} />
          <Row label="API key" value={settings.bureau.apiKeySet ? 'Saved' : 'Missing'} />
          <Row label="Client certificate" value={settings.bureau.certificateSet ? 'Uploaded' : 'Not uploaded'} />
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
      {label}
      {children}
    </label>
  );
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return <span className={`badge ${active ? 'badge-success' : 'badge-pending'}`}>{label}</span>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Webhook({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <code style={{ display: 'block', background: 'var(--bg-secondary, #f1f5f9)', padding: 10, borderRadius: 8, fontSize: 12, wordBreak: 'break-all' }}>
        {value}
      </code>
    </div>
  );
}
