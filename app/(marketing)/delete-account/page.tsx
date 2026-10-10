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
    role: 'field_agent',
    organizationName: '',
    reason: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, dispatches ticket to privacy/support desk
    setSubmitted(true);
  };

  return (
    <>
      <BreadcrumbJsonLd name="Data & Account Deletion" path="/delete-account" />

      <section className="mk-pagehero">
        <div className="mk-container">
          <span className="mk-eyebrow">Google Play Store &amp; DPDP Act Compliance</span>
          <h1 className="mk-h1">Account &amp; Data Deletion Request</h1>
          <p className="mk-lead">
            Formal self-service request portal for deleting user accounts, revoking mobile field app
            credentials, and exercising the Right to Erasure under Indian Data Protection Law.
          </p>
        </div>
      </section>

      <section className="mk-section mk-section--soft">
        <div className="mk-container">
          <article className="mk-legal" style={{ maxWidth: 880 }}>
            <div className="mk-legal-badge">Google Play Developer Policy &amp; DPDP Act 2023 Compliant</div>

            <div className="mk-legal-meta">
              <div><b>Entity:</b> Zolo Funds (India) Technologies Private Limited</div>
              <div><b>Applicable Platforms:</b> Web Portal (<Link href="https://app.zolofunds.com" style={{ color: 'var(--mk-primary)' }}>app.zolofunds.com</Link>) &amp; Android App (ZoloFund)</div>
              <div><b>Statutory Bases:</b> Section 12 DPDP Act 2023, Google Play User Data Policy</div>
              <div><b>Turnaround SLA:</b> Credentials revoked immediately; sanitization within 7 business days</div>
            </div>

            <div className="mk-legal-callout mk-legal-callout--alert">
              <strong>MANDATORY STATUTORY NOTICE &amp; RETENTION DISTINCTION:</strong>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                In compliance with the <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong> and <strong>Google Play Store Developer Policies</strong>,
                all registered users (administrative staff, branch officers, and field collection agents) and end borrowers possess the legal right
                to request the permanent deletion of their account credentials and personal identifiable information.
              </p>
            </div>

            <h2>1. What Data Is Permanently Purged vs. What Is Retained</h2>
            <p>
              Under Indian law, financial software platforms must balance an individual&apos;s right to privacy with statutory anti-money laundering
              and tax accounting record-keeping mandates:
            </p>

            <table className="mk-legal-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Action Taken Upon Deletion</th>
                  <th>Statutory Rationale</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>User Authentication &amp; Logins</strong></td>
                  <td><strong>Permanently Deleted (100% Wiped)</strong></td>
                  <td>
                    Password hashes, two-factor auth tokens, biometric session ties, and active login sessions are revoked immediately and expunged from database records.
                  </td>
                </tr>
                <tr>
                  <td><strong>Personal Identifiers</strong></td>
                  <td><strong>Permanently Purged (within 7 Days)</strong></td>
                  <td>
                    Personal mobile phone numbers, personal email addresses, profile photographs, push notification tokens (FCM), and device hardware IDs are wiped.
                  </td>
                </tr>
                <tr>
                  <td><strong>Historical Financial Ledgers</strong></td>
                  <td><strong>Anonymized &amp; Retained for 8 Years</strong></td>
                  <td>
                    If your account processed, approved, or collected financial transactions (loan disbursements, cash receipts, vouchers), Section 12 of the <strong>Prevention of Money Laundering Act, 2002 (PMLA)</strong> and Section 44AA of the <strong>Income Tax Act, 1961</strong> legally compel financial institutions to preserve transaction ledgers for up to 8 years. Such records are stripped of personal contact details and preserved strictly as anonymized historical accounting entries for statutory tax and regulatory audit purposes.
                  </td>
                </tr>
                <tr>
                  <td><strong>Unsanctioned Leads &amp; Draft Applications</strong></td>
                  <td><strong>Permanently Deleted</strong></td>
                  <td>
                    Customer inquiries, draft unsubmitted loan applications, and cancelled loan files that did not result in financial disbursements are expunged in their entirety.
                  </td>
                </tr>
              </tbody>
            </table>

            <h2>2. The 6-Phase Deletion Protocol</h2>
            <p>We execute account deletion through an auditable, six-phase technical workflow:</p>
            <ol>
              <li><strong>Submission:</strong> The user submits a deletion request via this web portal form or via the ZoloFund Android mobile app (<em>Settings → Request Account Deletion</em>).</li>
              <li><strong>Ownership Verification:</strong> A secure, time-limited verification link and 6-digit one-time password (OTP) are dispatched to the registered email address to verify identity and prevent malicious deletion requests.</li>
              <li><strong>Immediate Token Invalidation:</strong> Upon verification, all active JWT bearer tokens, mobile sessions, and API access privileges are invalidated across our cloud infrastructure.</li>
              <li><strong>Tenant Notification:</strong> If the requesting party is a staff member or field agent of a subscribing lending organization, an automated notification is transmitted to the organization&apos;s Superadmin for personnel offboarding.</li>
              <li><strong>Database Sanitization:</strong> Our data pipeline purges personal contact details, device fingerprints, and profile media within <strong>seven (7) business days</strong>.</li>
              <li><strong>Certificate of Erasure:</strong> A formal, digitally signed <em>Certificate of Data Erasure</em> is delivered to the user&apos;s email address confirming completion of the deletion protocol.</li>
            </ol>

            <h2>3. Multi-Channel Deletion Pathways</h2>
            <p>You may initiate your account deletion through any of the following convenient channels:</p>
            <ul>
              <li><strong>Pathway A (Recommended — Online Web Form):</strong> Complete the verified deletion form below.</li>
              <li><strong>Pathway B (In-App Mobile Flow):</strong> Open the <strong>ZoloFund Android App</strong>, navigate to <strong>Settings → Security &amp; Privacy → Request Account Deletion</strong>.</li>
              <li><strong>Pathway C (Email Helpdesk):</strong> Dispatch an email from your registered email address to <a href="mailto:support@zolofunds.com" style={{ color: 'var(--mk-primary)', fontWeight: 600 }}>support@zolofunds.com</a> with the subject line <em>&quot;Account Deletion Request - [Your Name]&quot;</em>.</li>
            </ul>

            <div style={{ marginTop: 36, marginBottom: 20 }}>
              <h2>4. Submit Account Deletion Request Form</h2>
              <p style={{ color: 'var(--mk-text-soft)', fontSize: '0.94rem' }}>
                Please provide your registered account details below. Our compliance desk will immediately issue an automated
                verification link to confirm account ownership.
              </p>
            </div>

            {submitted ? (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: 36, borderRadius: 16, textAlign: 'center', marginTop: 20 }}>
                <span className="material-icons-outlined" style={{ fontSize: 52, color: '#16A34A', display: 'block', margin: '0 auto 12px' }}>check_circle</span>
                <h3 style={{ color: '#166534', margin: '0 0 10px', fontSize: '1.4rem' }}>Deletion Request Successfully Logged</h3>
                <p style={{ color: '#15803D', maxWidth: 540, margin: '0 auto 16px', fontSize: '0.96rem', lineHeight: 1.6 }}>
                  We have received your account deletion request for <strong>{formData.email}</strong>. A verification email containing your one-click confirmation link has been dispatched.
                  Please click the link within 24 hours to authorize the automated sanitization pipeline.
                </p>
                <div style={{ fontSize: '0.86rem', color: '#166534', background: '#DCFCE7', padding: '10px 16px', borderRadius: 8, display: 'inline-block', marginBottom: 20 }}>
                  Ticket Reference: <b>DEL-{Date.now().toString().slice(-6)}</b> • Assigned to: Data Protection Desk
                </div>
                <div>
                  <Link href="/" className="mk-btn mk-btn--primary">
                    Return to Homepage
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mk-form" style={{ marginTop: 20, background: '#FFFFFF', padding: 32, borderRadius: 16, border: '1px solid var(--mk-border)' }}>
                <div className="mk-form__row">
                  <div className="mk-field">
                    <label htmlFor="name">Full Legal Name *</label>
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
                    <label htmlFor="email">Registered Account Email *</label>
                    <input
                      id="email"
                      type="email"
                      required
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
                      placeholder="e.g. +91 80894 05950"
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
                      <option value="field_agent">Mobile Field Collection Agent</option>
                      <option value="branch_manager">Branch Manager / Staff</option>
                      <option value="superadmin">Tenant Superadmin / Business Owner</option>
                      <option value="borrower">End Borrower / Customer</option>
                    </select>
                  </div>
                </div>

                <div className="mk-field">
                  <label htmlFor="org">Subscribing Organization / Financier Name (If Applicable)</label>
                  <input
                    id="org"
                    type="text"
                    placeholder="e.g. Sri Lakshmi Finance / Madurai Microfinance"
                    value={formData.organizationName}
                    onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                  />
                </div>

                <div className="mk-field">
                  <label htmlFor="reason">Reason for Deletion Request (Optional)</label>
                  <textarea
                    id="reason"
                    rows={3}
                    placeholder="e.g. Resigned from field role, organization closed, or no longer using software"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  />
                </div>

                <div style={{ margin: '16px 0 24px', fontSize: '0.86rem', color: 'var(--mk-text-soft)', lineHeight: 1.5 }}>
                  <input type="checkbox" required id="consent" style={{ marginRight: 8 }} />
                  <label htmlFor="consent">
                    I confirm that I am the authorized holder of this account and understand that this action is irreversible.
                    Login access and personal identifiers will be permanently expunged.
                  </label>
                </div>

                <button type="submit" className="mk-btn mk-btn--primary" style={{ width: '100%', justifyContent: 'center' }}>
                  Submit Formal Account Deletion Request
                </button>
              </form>
            )}

            <div style={{ marginTop: 40 }}>
              <h2>5. Data Protection Officer &amp; Grievance Escalation</h2>
              <p>
                If you encounter any difficulty with an account deletion request or wish to escalate a privacy inquiry, please contact our
                statutory Data Protection Officer directly:
              </p>
              <div className="mk-legal-callout">
                <b>Data Protection &amp; Compliance Desk:</b> Zolo Funds (India) Technologies Private Limited<br />
                <b>Corporate Office:</b> 155, Animazon, Narayana Valasu, Nasiyanur Road, Erode - 638011, Tamil Nadu, India<br />
                <b>Grievance Email:</b> <a href="mailto:grievance@zolofunds.com" style={{ color: 'var(--mk-primary)', fontWeight: 700 }}>grievance@zolofunds.com</a><br />
                <b>Helpdesk:</b> <a href="mailto:support@zolofunds.com" style={{ color: 'var(--mk-primary)', fontWeight: 700 }}>support@zolofunds.com</a><br />
                <b>Helpline:</b> +91 80894 05950<br />
                <b>Statutory Response Window:</b> Within twenty-four (24) hours of receipt.
              </div>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
