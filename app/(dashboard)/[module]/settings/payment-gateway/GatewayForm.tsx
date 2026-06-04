'use client';

import { useState, useTransition } from 'react';
import { saveGatewayAction } from './actions';

export default function GatewayForm({
  config,
  upiId: initialUpiId,
  webhookUrl,
}: {
  config: { enabled: boolean; keyId: string; keySecretSet: boolean; webhookSecretSet: boolean };
  upiId: string;
  webhookUrl: string;
}) {
  const [upiId, setUpiId] = useState(initialUpiId);
  const [enabled, setEnabled] = useState(config.enabled);
  const [keyId, setKeyId] = useState(config.keyId);
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveGatewayAction({ upiId, enabled, keyId, keySecret, webhookSecret });
      setMsg(res.success ? { ok: true, text: 'Saved.' } : { ok: false, text: res.error ?? 'Failed' });
      if (res.success) { setKeySecret(''); setWebhookSecret(''); }
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 680 }}>
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ margin: '0 0 4px' }}>Tier 0 · UPI (no account needed)</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 12px' }}>
          Enter your <strong>UPI ID</strong>. Borrowers get a QR with the exact amount,
          pay straight into your bank, then tap “I&apos;ve paid” — staff confirm it in the{' '}
          <strong>Self-Pay</strong> queue. Works immediately, no merchant account.
        </p>
        <Field label="Your UPI ID (VPA)">
          <input className="form-control" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourbusiness@okaxis" />
        </Field>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ margin: '0 0 4px' }}>Tier 1 · Razorpay (auto-confirm)</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 8px' }}>
          Connect <strong>your own</strong> Razorpay account so UPI/link payments
          settle into your bank and reconcile <em>automatically</em> — no manual confirm.
        </p>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '14px 0' }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>Enable live Razorpay payment links</span>
        </label>

        <Field label="Key ID (rzp_live_… / rzp_test_…)">
          <input className="form-control" value={keyId} onChange={(e) => setKeyId(e.target.value)} placeholder="rzp_live_xxxxxxxx" />
        </Field>

        <Field label={`Key Secret ${config.keySecretSet ? '· saved (leave blank to keep)' : ''}`}>
          <input className="form-control" type="password" value={keySecret} onChange={(e) => setKeySecret(e.target.value)} placeholder={config.keySecretSet ? '••••••••' : 'Key secret'} autoComplete="new-password" />
        </Field>

        <Field label={`Webhook Secret ${config.webhookSecretSet ? '· saved (leave blank to keep)' : ''}`}>
          <input className="form-control" type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder={config.webhookSecretSet ? '••••••••' : 'Webhook secret'} autoComplete="new-password" />
        </Field>

        <button className="btn btn-primary" onClick={save} disabled={pending} style={{ marginTop: 8 }}>
          {pending ? 'Saving…' : 'Save gateway'}
        </button>
        {msg && (
          <p style={{ marginTop: 10, fontSize: 13, color: msg.ok ? '#16a34a' : '#dc2626' }}>{msg.text}</p>
        )}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Set up in your Razorpay dashboard</h3>
        <ol style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', paddingLeft: 18 }}>
          <li>Settings → API Keys → generate Key ID + Secret → paste above.</li>
          <li>Settings → Webhooks → <strong>Add New Webhook</strong> with this URL:</li>
        </ol>
        <code style={{ display: 'block', background: 'var(--bg-secondary, #f1f5f9)', padding: 12, borderRadius: 8, fontSize: 13, wordBreak: 'break-all' }}>
          {webhookUrl}
        </code>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 10 }}>
          Set the webhook&apos;s <strong>secret</strong> to a value of your choice, enter the
          <em> same</em> value above, and subscribe to events:{' '}
          <code>payment_link.paid</code>, <code>payment.captured</code>, <code>order.paid</code>.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}
