'use client';

import { useState } from 'react';
import Link from 'next/link';

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; reference: string | null; email: string; ackSent: boolean };

export default function DeletionRequestForm() {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'field_agent',
    organization: '',
    reason: '',
    website: '', // honeypot
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ kind: 'sending' });
    try {
      const res = await fetch('/api/deletion-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setState({
          kind: 'error',
          message: data?.error || 'Could not submit your request. Please email support@zolofunds.com.',
        });
        return;
      }
      setState({ kind: 'done', reference: data.reference, email: formData.email, ackSent: !!data.acknowledgementSent });
    } catch {
      setState({ kind: 'error', message: 'Network error. Please try again or email support@zolofunds.com.' });
    }
  };

  if (state.kind === 'done') {
    return (
      <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: 36, borderRadius: 16, textAlign: 'center', marginTop: 20 }}>
        <span className="material-icons-outlined" style={{ fontSize: 52, color: '#16A34A', display: 'block', margin: '0 auto 12px' }}>check_circle</span>
        <h3 style={{ color: '#166534', margin: '0 0 10px', fontSize: '1.4rem' }}>Request received</h3>
        <p style={{ color: '#15803D', maxWidth: 540, margin: '0 auto 16px', fontSize: '0.96rem', lineHeight: 1.6 }}>
          {state.ackSent ? (
            <>We have emailed a confirmation to <strong>{state.email}</strong>. </>
          ) : null}
          Our team will contact you on your registered email or mobile number to confirm the request came from you,
          then complete it within 7 business days.
        </p>
        {state.reference && (
          <div style={{ fontSize: '0.86rem', color: '#166534', background: '#DCFCE7', padding: '10px 16px', borderRadius: 8, display: 'inline-block', marginBottom: 20 }}>
            Your reference: <b>{state.reference}</b>
          </div>
        )}
        <div>
          <Link href="/" className="mk-btn mk-btn--primary">
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  const sending = state.kind === 'sending';

  return (
    <form onSubmit={handleSubmit} className="mk-form" style={{ marginTop: 20, background: '#FFFFFF', padding: 32, borderRadius: 16, border: '1px solid var(--mk-border)' }}>
      <div className="mk-form__row">
        <div className="mk-field">
          <label htmlFor="name">Full Name *</label>
          <input
            id="name"
            type="text"
            required
            maxLength={255}
            placeholder="e.g. Ramesh Kumar"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div className="mk-field">
          <label htmlFor="email">Registered Email *</label>
          <input
            id="email"
            type="email"
            required
            maxLength={255}
            placeholder="e.g. ramesh@organization.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
      </div>

      <div className="mk-form__row">
        <div className="mk-field">
          <label htmlFor="phone">Registered Mobile Number *</label>
          <input
            id="phone"
            type="tel"
            required
            maxLength={20}
            placeholder="e.g. +91 98765 43210"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>
        <div className="mk-field">
          <label htmlFor="role">Account Role *</label>
          <select
            id="role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            style={{ height: 46, padding: '0 12px', borderRadius: 8, border: '1px solid var(--mk-border)', width: '100%' }}
          >
            <option value="field_agent">Field Collection Agent</option>
            <option value="branch_manager">Branch Manager / Staff</option>
            <option value="superadmin">Business Owner / Superadmin</option>
            <option value="borrower">Borrower / Customer</option>
          </select>
        </div>
      </div>

      <div className="mk-field">
        <label htmlFor="org">Lending Organisation Name (if applicable)</label>
        <input
          id="org"
          type="text"
          maxLength={255}
          placeholder="e.g. Sri Lakshmi Finance"
          value={formData.organization}
          onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
        />
      </div>

      <div className="mk-field">
        <label htmlFor="reason">Reason (optional)</label>
        <textarea
          id="reason"
          rows={3}
          maxLength={2000}
          placeholder="e.g. Left the organisation, no longer using the app"
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
        />
      </div>

      {/* Honeypot — hidden from people, filled by bots. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="website">Website</label>
        <input
          id="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={formData.website}
          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
        />
      </div>

      <div style={{ margin: '16px 0 24px', fontSize: '0.86rem', color: 'var(--mk-text-soft)', lineHeight: 1.5 }}>
        <input type="checkbox" required id="consent" style={{ marginRight: 8 }} />
        <label htmlFor="consent">
          I confirm I am the holder of this account. I understand that once the request is verified, my login access and
          personal details will be removed and this cannot be undone.
        </label>
      </div>

      {state.kind === 'error' && (
        <div role="alert" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>
          {state.message}
        </div>
      )}

      <button type="submit" disabled={sending} className="mk-btn mk-btn--primary" style={{ width: '100%', justifyContent: 'center', opacity: sending ? 0.7 : 1 }}>
        {sending ? 'Submitting…' : 'Submit Deletion Request'}
      </button>
    </form>
  );
}
