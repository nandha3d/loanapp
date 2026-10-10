import Link from 'next/link';
import { buildMetadata } from '../_components/seo';
import { BreadcrumbJsonLd } from '../_components/JsonLd';

export const metadata = buildMetadata({
  title: 'Data Security & Architecture Overview | Zolo Funds',
  description:
    'Technical security, multi-tenant database isolation, cryptographic controls, and compliance architecture of the Zolo Funds lending operating system.',
  path: '/security',
  keywords: [
    'Zolo Funds security',
    'fintech data security India',
    'multi tenant database isolation',
    'lending software compliance',
  ],
});

export default function SecurityOverviewPage() {
  const lastUpdated = 'October 10, 2026';

  return (
    <>
      <BreadcrumbJsonLd name="Security & Architecture" path="/security" />

      <section className="mk-pagehero">
        <div className="mk-container">
          <span className="mk-eyebrow">Enterprise Trust</span>
          <h1 className="mk-h1">Data Security & Compliance</h1>
          <p className="mk-lead">
            Enterprise-grade data isolation, cryptographic protections, and operational controls
            engineered for financial institutions, NBFCs, and micro-lenders.
          </p>
        </div>
      </section>

      <section className="mk-section mk-section--soft">
        <div className="mk-container">
          <article className="mk-legal">
            <div className="mk-legal-badge">Bank-Grade Multi-Tenant Architecture</div>

            <div className="mk-legal-meta">
              <div><b>Scope:</b> Web Portal, Cloud APIs, Mobile Applications, Database Layer</div>
              <div><b>Audited Security Baseline:</b> OWASP Top 10, ISO 27001 Data Centers, TLS 1.3</div>
              <div><b>Last Updated:</b> {lastUpdated}</div>
            </div>

            <h2>1. Multi-Tenant Logical Data Isolation</h2>
            <p>
              In multi-tenant SaaS systems, the most vital architectural requirement is preventing any possibility of cross-tenant
              data leakage. Zolo Funds implements strict, multi-layered isolation:
            </p>
            <ul>
              <li><strong>Mandatory Scoping (SCOPE-1):</strong> Every single database table storing loans, customers, collections, accounts, ledgers, or users has a mandatory, indexed <code>tenantId</code> column.</li>
              <li><strong>Zero Cross-Tenant Leakage:</strong> All database queries (via Prisma ORM and raw SQL builders) enforce tenant scoping at the framework layer. A query originating from Tenant A is strictly prohibited from returning or modifying rows belonging to Tenant B.</li>
              <li><strong>Branch Scoping (SCOPE-2):</strong> Within an organization, branch-level access control limits loan officers and branch managers to accounts assigned to their specific authorized branches.</li>
            </ul>

            <h2>2. Cryptographic Security Standards</h2>
            <table className="mk-legal-table">
              <thead>
                <tr>
                  <th>Layer</th>
                  <th>Standard Employed</th>
                  <th>Implementation Detail</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Data in Transit</strong></td>
                  <td>TLS 1.3 / HTTPS</td>
                  <td>Strict HTTP Strict Transport Security (HSTS) with 256-bit encryption. Plain HTTP is rejected.</td>
                </tr>
                <tr>
                  <td><strong>Data at Rest</strong></td>
                  <td>AES-256</td>
                  <td>Database volumes and automated encrypted off-site backups utilize AES-256 encryption.</td>
                </tr>
                <tr>
                  <td><strong>User Authentication</strong></td>
                  <td>bcrypt with Salt</td>
                  <td>User passwords are one-way hashed with salted bcrypt. Passwords are never logged or visible to developers.</td>
                </tr>
                <tr>
                  <td><strong>Mobile API Tokens</strong></td>
                  <td>Short-lived HMAC JWT</td>
                  <td>Mobile field agents communicate via digitally signed bearer tokens with automatic revocation support.</td>
                </tr>
              </tbody>
            </table>

            <h2>3. Role-Based Access Control (RBAC) & Segregation of Duties</h2>
            <p>
              Zolo Funds enforces strict principle-of-least-privilege access across all user tiers:
            </p>
            <ul>
              <li><strong>Superadmin (Business Owner):</strong> Full organization oversight, branch creation, billing management, and policy exception waivers.</li>
              <li><strong>Branch Manager / Admin:</strong> Operational management, loan application approvals within authorized limits, and branch daily reconciliation.</li>
              <li><strong>Field Collection Agent:</strong> Restricted exclusively to viewing their assigned daily collection routes, recording receipts, and onboarding new customer applications. Cannot edit past settled transactions or view sensitive company ledgers.</li>
              <li><strong>Accountant / Cashier:</strong> Double-entry journal voucher creation, bank reconciliation, and cash float remittance verification.</li>
            </ul>

            <h2>4. Financial Ledger Integrity & Immutable Transactions</h2>
            <div className="mk-legal-callout">
              <strong>Zero Silent Edits (MONEY Core):</strong>
              <p style={{ marginTop: 6, marginBottom: 0 }}>
                In financial accounting, silently deleting or altering a recorded repayment transaction is prohibited. Zolo Funds
                enforces an append-only transaction ledger. Correcting an erroneous repayment requires an authorized reversal
                with an explicit maker-checker approval audit record.
              </p>
            </div>

            <h2>5. Mobile Field Device Security & Offline Queue Safety</h2>
            <ul>
              <li><strong>Hardware Biometrics:</strong> The Android mobile app supports on-device fingerprint and Face Unlock using Android Keystore.</li>
              <li><strong>Encrypted Offline Cache:</strong> When field agents operate in low-connectivity rural areas, queued collections are stored in an encrypted local database. Upon reconnecting, transactions are synced with cryptographically verified idempotency keys to eliminate duplicate payments.</li>
              <li><strong>Remote Session Termination:</strong> In the event a field officer loses a smartphone, administrators can immediately revoke the device session from the Superadmin dashboard.</li>
            </ul>

            <h2>6. Cloud Infrastructure & Backup Redundancy</h2>
            <ul>
              <li><strong>Tier-3 Data Center Standards:</strong> High-performance VPS architecture hosted with ISO 27001, SOC 2 Type II certified cloud infrastructure.</li>
              <li><strong>Automated Daily Backups:</strong> Nightly database snapshots are generated, encrypted, and preserved with geographic replication.</li>
              <li><strong>DDoS & Perimeter Protection:</strong> Web Application Firewall (WAF) filtering and rate-limiting protect against brute-force credential stuffing and volumetric traffic attacks.</li>
            </ul>

            <h2>7. Reporting Security Vulnerabilities</h2>
            <p>
              We welcome responsible security research. If you believe you have discovered a potential vulnerability in our
              platform, please contact our security team directly:
            </p>
            <div className="mk-legal-callout">
              <b>Security Desk:</b> <a href="mailto:security@zolofunds.com" style={{ color: 'var(--mk-primary)' }}>security@zolofunds.com</a> / <a href="mailto:support@zolofunds.com" style={{ color: 'var(--mk-primary)' }}>support@zolofunds.com</a><br />
              We respond to validated security disclosures within 24 hours.
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
