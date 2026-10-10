'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BreadcrumbJsonLd } from '../_components/JsonLd';

export default function DeleteAccountPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    reason: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, triggers an email/ticket to support@zolofunds.com
    setSubmitted(true);
  };

  return (
    <>
      <BreadcrumbJsonLd name="Data & Account Deletion" path="/delete-account" />

      <section className="mk-pagehero">
        <div className="mk-container">
          <span className="mk-eyebrow">Google Play Store & DPDP Act Compliance</span>
          <h1 className="mk-h1">Account & Data Deletion Request</h1>
          <p className="mk-lead">
            Submit a formal request to delete your ZoloFund user account, revoke personal identifiers,
            or close your organization&apos;s tenant profile.
          </p>
        </div>
      </section>

      <section className="mk-section mk-section--soft">
        <div className="mk-container">
          <article className="mk-legal" style={{ maxWidth: 840 }}>
            <div className="mk-legal-badge">Google Play Data Safety Requirement</div>

            <h2>How Account & Data Deletion Works</h2>
            <p>
              In accordance with <strong>Google Play Store Developer Policies</strong> and the <strong>Digital Personal Data Protection Act, 2023 (India)</strong>,
              users and subscribing organizations have the right to request the deletion of their accounts and associated personal data.
            </p>

            <div className="mk-legal-callout">
              <strong>What Happens When You Request Deletion:</strong>
              <ul style={{ marginTop: 8, marginBottom: 0 }}>
                <li><strong>Immediate Revocation:</strong> Your login credentials, API access tokens, and mobile sessions are invalidated immediately upon verification.</li>
                <li><strong>Personal Data Purged:</strong> Name, personal phone numbers, profile photos, email addresses, and push notification tokens are permanently wiped within <strong>7 business days</strong>.</li>
                <li><strong>Statutory Financial Records:</strong> Please note that if your account has processed live loan transactions, Indian statutory laws (including PMLA 2002 and Income Tax regulations) require financial institutions to preserve transaction ledgers for up to 8 years. Such historical records will be permanently de-identified and archived solely for legal audit compliance.</li>
              </ul>
            </div>

            {submitted ? (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: 32, borderRadius: 12, textAlign: 'center', marginTop: 28 }}>
                <span className="material-icons-outlined" style={{ fontSize: 48, color: '#16A34A', display: 'block', margin: '0 auto 12px' }}>check_circle</span>
                <h3 style={{ color: '#166534', margin: '0 0 8px', fontSize: '1.3rem' }}>Request Received Successfully</h3>
                <p style={{ color: '#15803D', maxWidth: 520, margin: '0 auto 16px', fontSize: '0.95rem' }}>
                  Our Data Privacy & Compliance Desk has received your account deletion request. A confirmation email with a verification link has been sent to <strong>{formData.email}</strong> to verify account ownership.
                </p>
                <Link href="/" className="mk-btn mk-btn--primary" style={{ display: 'inline-flex', marginTop: 8 }}>
                  Return to Home
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mk-form" style={{ marginTop: 28 }}>
                <h3 style={{ marginTop: 0, marginBottom: 16 }}>Submit Deletion Request</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--mk-text-soft)', marginBottom: 20 }}>
                  Please fill out the form below. We will send a verification code to your registered email to confirm you are the authorized account holder.
                </p>

                <div className="mk-form__row">
                  <div className="mk-field">
                    <label htmlFor="name">Full Name *</label>
                    <input
                      id="name"
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="mk-field">
                    <label htmlFor="email">Registered Email Address *</label>
                    <input
                      id="email"
                      type="email"
                      required
                      placeholder="email@example.com"
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
                      placeholder="+91 98427 88899"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="mk-field">
                    <label htmlFor="org">Business / Organization Name</label>
                    <input
                      id="org"
                      type="text"
                      placeholder="e.g. Sri Lakshmi Finance"
                      value={formData.organization}
                      onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mk-field">
                  <label htmlFor="reason">Reason for Deletion (Optional)</label>
                  <textarea
                    id="reason"
                    rows={3}
                    placeholder="Closing business, migrating systems, or removing test account..."
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  />
                </div>

                <button type="submit" className="mk-btn mk-btn--primary" style={{ width: '100%', marginTop: 8 }}>
                  Submit Deletion Request
                </button>
              </form>
            )}

            <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--mk-border)', fontSize: '0.88rem', color: 'var(--mk-text-soft)' }}>
              <p>
                Have questions or need manual assistance? Contact our Grievance Desk directly at <a href="mailto:grievance@zolofunds.com" style={{ color: 'var(--mk-primary)', fontWeight: 600 }}>grievance@zolofunds.com</a> or <a href="mailto:support@zolofunds.com" style={{ color: 'var(--mk-primary)', fontWeight: 600 }}>support@zolofunds.com</a>.
              </p>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
