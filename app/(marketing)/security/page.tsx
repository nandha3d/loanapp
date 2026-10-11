import Link from 'next/link';
import { buildMetadata } from '../_components/seo';
import { BreadcrumbJsonLd } from '../_components/JsonLd';

export const metadata = buildMetadata({
  title: 'Data Security | Zolo Funds',
  description:
    'How Zolo Funds protects lending data: tenant and branch isolation, encryption in transit and of sensitive fields, role-based access, approvals, backups and data residency in India.',
  path: '/security',
  keywords: [
    'Zolo Funds data security',
    'loan software security India',
    'multi-tenant data isolation',
    'DPDP Act technical safeguards',
  ],
});

// Every statement on this page must be true of the running system today
// (Google Play User Data policy + DPDP Act). Do not add aspirational claims;
// change the system first, then the page.
export default function SecurityOverviewPage() {
  const lastUpdated = 'October 11, 2026';

  return (
    <>
      <BreadcrumbJsonLd name="Security" path="/security" />

      <section className="mk-pagehero">
        <div className="mk-container">
          <span className="mk-eyebrow">Security</span>
          <h1 className="mk-h1">How we protect your data</h1>
          <p className="mk-lead">
            The safeguards that protect loan books, borrower KYC and collection records on the Zolo Funds web portal and the
            ZoloFund Android app.
          </p>
        </div>
      </section>

      <section className="mk-section mk-section--soft">
        <div className="mk-container">
          <article className="mk-legal">
            <div className="mk-legal-meta">
              <div><b>Entity:</b> Zolo Funds (India) Technologies Private Limited</div>
              <div><b>Scope:</b> Web portal, APIs, Android app, database</div>
              <div><b>Last Updated:</b> {lastUpdated}</div>
            </div>

            <h2>1. Isolation between businesses and branches</h2>
            <p>Many lending businesses share the platform, so every record is separated along four axes, checked on the server for every request:</p>
            <table className="mk-legal-table">
              <thead>
                <tr>
                  <th>Axis</th>
                  <th>What it means</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Business (tenant)</strong></td>
                  <td>Every query is filtered by the business it belongs to. One lender can never read or change another lender&apos;s data.</td>
                </tr>
                <tr>
                  <td><strong>Module</strong></td>
                  <td>Data of each lending module (for example micro-lending) is kept separate from other modules in the same business.</td>
                </tr>
                <tr>
                  <td><strong>Branch</strong></td>
                  <td>A record belongs to exactly one branch. Branch staff and agents see only their own branch.</td>
                </tr>
                <tr>
                  <td><strong>Role</strong></td>
                  <td>Owners, branch admins and field agents get different permissions, enforced by the server rather than only hidden in the app.</td>
                </tr>
              </tbody>
            </table>

            <h2>2. Encryption</h2>
            <ul>
              <li><strong>In transit:</strong> all traffic between browsers, the Android app and our servers uses HTTPS (TLS 1.2 or 1.3), with HTTP Strict Transport Security (HSTS) enabled.</li>
              <li><strong>Sensitive fields:</strong> Aadhaar numbers and integration credentials (bureau, KYC and payment-gateway keys) are encrypted in the database with AES-256-GCM. Aadhaar numbers are shown masked.</li>
              <li><strong>Passwords:</strong> stored only as salted bcrypt hashes; nobody, including our staff, can read them.</li>
            </ul>

            <h2>3. Access control &amp; approvals</h2>
            <ul>
              <li><strong>Role-based access:</strong> field agents record collections and register customers; they cannot change loan terms or see the business&apos;s accounts.</li>
              <li><strong>Maker-checker approvals:</strong> customers registered or edited by field agents, loan edits and collection corrections go to an admin for approval, with a before/after view.</li>
              <li><strong>Audit trail:</strong> approval requests record who raised and who decided them, and when; penalty waiver requests must include a reason.</li>
              <li><strong>Login protection:</strong> sign-in and verification endpoints are rate-limited to slow down password guessing.</li>
            </ul>

            <h2>4. The ZoloFund Android app</h2>
            <ul>
              <li><strong>App lock:</strong> optional fingerprint / face unlock using Android&apos;s biometric system. Biometric data stays on the phone.</li>
              <li><strong>Login tokens:</strong> kept in Android Keystore-backed secure storage.</li>
              <li><strong>Location:</strong> used only while the app is open, to stamp collections and visits. See the <Link href="/privacy" style={{ color: 'var(--mk-primary)', fontWeight: 600 }}>Privacy Policy</Link> for every permission.</li>
              <li><strong>Camera &amp; photos:</strong> KYC and collateral photos are uploaded to your business&apos;s account; they are not saved to the phone gallery by the app.</li>
            </ul>

            <h2>5. Backups</h2>
            <ul>
              <li>The full database is backed up automatically every day and backups are kept for 30 days.</li>
              <li>Backup files are readable only by the server administrator account.</li>
            </ul>

            <h2>6. Hosting &amp; data residency</h2>
            <ul>
              <li>The application and database run on a virtual private server operated by Hostinger International Ltd in <strong>Mumbai, India</strong>.</li>
              <li>Subscription payments are processed by Razorpay, a PCI-DSS certified payment gateway. We never see or store card numbers.</li>
              <li>Other service providers (KYC, credit bureaus, messaging, push notifications) are listed in the <Link href="/privacy" style={{ color: 'var(--mk-primary)', fontWeight: 600 }}>Privacy Policy</Link>.</li>
            </ul>

            <h2>7. Security incidents</h2>
            <p>
              If we find a security incident affecting personal data, we contain it, inform the affected businesses without undue delay, and report it
              to CERT-In and the Data Protection Board of India as Indian law requires.
            </p>

            <h2>8. Reporting a vulnerability</h2>
            <p>
              If you find a security problem, please tell us privately before sharing it publicly. We will not take legal action against anyone who
              reports in good faith without accessing or changing customer data.
            </p>
            <div className="mk-legal-callout">
              <b>Entity:</b> Zolo Funds (India) Technologies Private Limited<br />
              <b>Office:</b> 155, Animazon, Narayana Valasu, Nasiyanur Road, Erode - 638011, Tamil Nadu, India<br />
              <b>Email:</b> <a href="mailto:support@zolofunds.com?subject=Security%20report" style={{ color: 'var(--mk-primary)', fontWeight: 700 }}>support@zolofunds.com</a> (subject: &quot;Security report&quot;)<br />
              <b>Helpline:</b> +91 80894 05950<br />
              <b>Acknowledgement:</b> within 24 hours
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
