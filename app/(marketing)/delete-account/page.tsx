import { LEGAL } from '@/lib/legalEntity';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BreadcrumbJsonLd } from '../_components/JsonLd';
import DeletionRequestForm from './DeletionRequestForm';

export const metadata: Metadata = {
  title: 'Account & Data Deletion Request | Zolo Funds',
  description:
    'Request deletion of your Zolo Funds / ZoloFund app account and personal data. Explains what is deleted, what is retained by law, and how long it takes.',
};

export default function DeleteAccountPage() {
  return (
    <>
      <BreadcrumbJsonLd name="Data & Account Deletion" path="/delete-account" />

      <section className="mk-pagehero">
        <div className="mk-container">
          <span className="mk-eyebrow">Your right to erasure</span>
          <h1 className="mk-h1">Account &amp; Data Deletion Request</h1>
          <p className="mk-lead">
            Request deletion of your Zolo Funds account (web portal and the ZoloFund Android app) and the personal data
            linked to it.
          </p>
        </div>
      </section>

      <section className="mk-section mk-section--soft">
        <div className="mk-container">
          <article className="mk-legal" style={{ maxWidth: 880 }}>
            <div className="mk-legal-badge">DPDP Act 2023 &middot; Google Play User Data policy</div>

            <div className="mk-legal-meta">
              <div><b>Developer:</b> {LEGAL.operator}</div>
              <div><b>Applies to:</b> Web portal (<Link href="https://app.zolofunds.com" style={{ color: 'var(--mk-primary)' }}>app.zolofunds.com</Link>) &amp; ZoloFund Android app</div>
              <div><b>Timeline:</b> Completed within 7 business days after we confirm the request is yours</div>
            </div>

            <div className="mk-legal-callout mk-legal-callout--alert">
              <strong>Who can request deletion</strong>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                Any registered user — business owners, branch staff and field collection agents — can ask us to delete their
                account and personal data. Borrowers&apos; loan records belong to their lender; we forward borrower requests
                to the lender and help them complete it.
              </p>
            </div>

            <h2>1. What is deleted and what is kept</h2>
            <table className="mk-legal-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>What happens</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Login &amp; sessions</strong></td>
                  <td><strong>Revoked and deleted</strong></td>
                  <td>Password hash, active sessions and app login tokens are removed so the account can no longer be used.</td>
                </tr>
                <tr>
                  <td><strong>Personal details</strong></td>
                  <td><strong>Deleted</strong></td>
                  <td>Name, mobile number, email, profile photo, push-notification tokens and device identifiers linked to your account.</td>
                </tr>
                <tr>
                  <td><strong>Financial transaction records</strong></td>
                  <td><strong>Kept up to 8 years, without your contact details</strong></td>
                  <td>
                    Loans, collections, receipts and vouchers your account handled must be preserved under the{' '}
                    <strong>Prevention of Money Laundering Act, 2002</strong> and the <strong>Income Tax Act, 1961</strong>.
                    They are kept only for audit and regulatory purposes.
                  </td>
                </tr>
                <tr>
                  <td><strong>Unsubmitted leads &amp; drafts</strong></td>
                  <td><strong>Deleted</strong></td>
                  <td>Enquiries and draft applications that never led to a loan are removed completely.</td>
                </tr>
              </tbody>
            </table>

            <h2>2. How we process your request</h2>
            <ol>
              <li><strong>You submit</strong> the form below, or email us (see section 3).</li>
              <li><strong>We acknowledge</strong> by email with a reference number.</li>
              <li><strong>We confirm it is you</strong> by contacting you on your registered email or mobile number. This stops anyone else from deleting your account.</li>
              <li>
                <strong>We complete it.</strong> For staff and owner accounts we inform your organisation&apos;s owner, revoke
                your access and delete your personal details. For borrowers we forward the request to your lender.
              </li>
              <li><strong>We email you</strong> when the request is complete — within 7 business days of confirmation.</li>
            </ol>

            <h2>3. Ways to request deletion</h2>
            <ul>
              <li><strong>Online form:</strong> fill in the form below (recommended).</li>
              <li><strong>From the app:</strong> open the ZoloFund Android app → <strong>Settings → Request Account Deletion</strong>. This opens this page.</li>
              <li>
                <strong>Email:</strong> write from your registered email to{' '}
                <a href="mailto:support@zolofunds.com?subject=Account%20Deletion%20Request" style={{ color: 'var(--mk-primary)', fontWeight: 600 }}>support@zolofunds.com</a>{' '}
                with the subject <em>&quot;Account Deletion Request&quot;</em>.
              </li>
            </ul>

            <div style={{ marginTop: 36, marginBottom: 20 }}>
              <h2>4. Deletion request form</h2>
              <p style={{ color: 'var(--mk-text-soft)', fontSize: '0.94rem' }}>
                Use the email and mobile number registered on your account so we can find and verify it.
              </p>
            </div>

            <DeletionRequestForm />

            <div style={{ marginTop: 40 }}>
              <h2>5. Questions &amp; grievances</h2>
              <p>If something goes wrong with your request, contact our Data Protection &amp; Grievance desk:</p>
              <div className="mk-legal-callout">
                <b>Entity:</b> {LEGAL.operator}<br />
                <b>Office:</b> {LEGAL.address}<br />
                <b>Grievance email:</b> <a href="mailto:grievance@zolofunds.com" style={{ color: 'var(--mk-primary)', fontWeight: 700 }}>grievance@zolofunds.com</a><br />
                <b>Support:</b> <a href="mailto:support@zolofunds.com" style={{ color: 'var(--mk-primary)', fontWeight: 700 }}>support@zolofunds.com</a><br />
                <b>Helpline:</b> +91 80894 05950 (Mon–Sat, 9:30 AM – 6:30 PM IST)<br />
                <b>Acknowledgement:</b> within 24 hours of receipt
              </div>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
