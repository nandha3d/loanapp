import Link from 'next/link';
import { buildMetadata } from '../_components/seo';
import { BreadcrumbJsonLd } from '../_components/JsonLd';

export const metadata = buildMetadata({
  title: 'Data Security & Compliance Architecture | Zolo Funds',
  description:
    'Comprehensive Data Security, Cryptographic Architecture, Multi-Tenant Database Isolation, and Compliance Overview for the Zolo Funds lending operating system and mobile application.',
  path: '/security',
  keywords: [
    'Zolo Funds data security',
    'fintech cloud security India',
    'multi-tenant database isolation',
    'RBI digital lending data security',
    'DPDP Act technical safeguards',
    'financial ledger encryption',
  ],
});

export default function SecurityOverviewPage() {
  const lastUpdated = 'October 10, 2026';

  return (
    <>
      <BreadcrumbJsonLd name="Security & Architecture" path="/security" />

      <section className="mk-pagehero">
        <div className="mk-container">
          <span className="mk-eyebrow">Enterprise Trust & Protection</span>
          <h1 className="mk-h1">Data Security & Architecture</h1>
          <p className="mk-lead">
            Comprehensive technical specification of cryptographic safeguards, multi-tenant database
            isolation, RBAC governance, and operational resilience protecting financial institutions.
          </p>
        </div>
      </section>

      <section className="mk-section mk-section--soft">
        <div className="mk-container">
          <article className="mk-legal">
            <div className="mk-legal-badge">Bank-Grade Multi-Tenant Cloud Architecture</div>

            <div className="mk-legal-meta">
              <div><b>Entity:</b> Zolo Funds (India) Technologies Private Limited</div>
              <div><b>Security Scope:</b> Web Applications, REST APIs, Android Mobile App, Relational Database</div>
              <div><b>Security Baseline:</b> OWASP Top 10, ISO/IEC 27001 Data Centers, TLS 1.3, AES-256</div>
              <div><b>Last Updated:</b> {lastUpdated}</div>
            </div>

            <div className="mk-legal-callout mk-legal-callout--alert">
              <strong>SECURITY COMMITMENT TO FINANCIAL INSTITUTIONS:</strong>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                Zolo Funds is engineered from the ground up to protect high-volume financial transactions, borrower KYC documents,
                and double-entry accounting ledgers. We implement a strict defense-in-depth model where logical tenant boundaries,
                cryptographic protections, role-based controls, and immutable ledger engines guarantee that your organization&apos;s
                data remains private, tamper-proof, and resilient against data loss or unauthorized exfiltration.
              </p>
            </div>

            <h2>1. Architectural Philosophy &amp; Defense-in-Depth</h2>
            <p>
              In financial technology and lending software, security cannot be an afterthought or an external wrapper.
              Zolo Funds employs a holistic <strong>Defense-in-Depth</strong> paradigm spanning four distinct structural tiers:
            </p>
            <ul>
              <li><strong>Network Tier:</strong> Distributed Denial of Service (DDoS) mitigation, Web Application Firewall (WAF) packet inspection, geo-restricted API endpoints, and forced TLS 1.3 protocol encryption.</li>
              <li><strong>Application Tier:</strong> Next.js Server Components, API route-level authorization guards, strict request schema validation, CSRF defenses, and rate limiting.</li>
              <li><strong>Data Tier:</strong> Relational PostgreSQL database with strict foreign-key integrity, multi-tenant row-level partitioning, append-only financial ledger journal tables, and AES-256 encryption-at-rest.</li>
              <li><strong>Mobile Device Tier:</strong> Hardened Android application with Android Keystore hardware biometric integration, certificate pinning, and zero storage of plaintext tokens or cached KYC photos.</li>
            </ul>

            <h2>2. Multi-Tenant Logical Schema Isolation: The Four Scoping Axes</h2>
            <p>
              In a shared cloud multi-tenant ecosystem, the single most critical architectural imperative is guaranteeing absolute
              isolation between competing financial institutions. Zolo Funds enforces <strong>The Four Scoping Axes</strong>
              at the architectural and ORM layer:
            </p>

            <table className="mk-legal-table">
              <thead>
                <tr>
                  <th>Scoping Axis</th>
                  <th>Architectural Enforcement</th>
                  <th>Security Guarantee</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>SCOPE-1: Tenant Axis</strong></td>
                  <td>
                    Every database entity (loans, customers, repayments, vouchers, users, branches, settings) possesses an immutable, indexed <code>tenantId</code> column.
                  </td>
                  <td>
                    <strong>Zero Cross-Tenant Leakage:</strong> All ORM queries and SQL projections inject tenant identity verified from cryptographically signed session tokens. A query originating from Organization A cannot physically read or modify rows belonging to Organization B.
                  </td>
                </tr>
                <tr>
                  <td><strong>SCOPE-2: Branch Axis</strong></td>
                  <td>
                    Subscribing organizations operate multiple geographical branches. Operational accounts, customers, and field agents are scoped to authorized <code>branchId</code> keys.
                  </td>
                  <td>
                    Branch managers and field collection staff are strictly isolated to their assigned operational jurisdiction, preventing unauthorized access across regional branch offices.
                  </td>
                </tr>
                <tr>
                  <td><strong>SCOPE-3: Role / RBAC Axis</strong></td>
                  <td>
                    Enforces strict principle-of-least-privilege permissions across Superadmin, Branch Admin, Loan Officer, Cashier, and Field Agent roles.
                  </td>
                  <td>
                    Sensitive administrative actions (interest rate edits, loan sanction overrides, write-offs, penalty waivers) are blocked at the server API layer for unauthorized staff.
                  </td>
                </tr>
                <tr>
                  <td><strong>SCOPE-4: Temporal Axis</strong></td>
                  <td>
                    Transactions, daily collection sheets, and ledger balances are tied to immutable date stamps and active financial years.
                  </td>
                  <td>
                    Historical closed financial periods and balanced day-books cannot be retroactively modified without explicit superadmin audit logging and compensating journal vouchers.
                  </td>
                </tr>
              </tbody>
            </table>

            <h2>3. Cryptographic Standards &amp; Key Governance</h2>
            <p>We deploy modern, mathematically proven cryptographic ciphers across all stages of data lifecycle:</p>
            <ul>
              <li>
                <strong>Data in Transit (TLS 1.3):</strong> All network traffic between web browsers, Android mobile devices, and our cloud servers is encrypted using Transport Layer Security (TLS 1.3). Legacy, insecure ciphers (SSLv3, TLS 1.0, TLS 1.1) are permanently disabled. We implement HTTP Strict Transport Security (HSTS) with a 31536000-second max-age and preload directives.
              </li>
              <li>
                <strong>Data at Rest (AES-256):</strong> Relational database storage volumes, automated snapshot archives, and off-site cloud backups are encrypted using Advanced Encryption Standard with 256-bit keys (AES-256).
              </li>
              <li>
                <strong>Authentication &amp; Password Hashing:</strong> User passwords are never stored in plaintext or reversible encryption. We use industry-standard salted <strong>bcrypt</strong> (work factor 12) to hash administrative and mobile credentials, ensuring resistance against rainbow table and brute-force attacks.
              </li>
              <li>
                <strong>API Session Tokens:</strong> Mobile field agents and administrative web portals authenticate via digitally signed, time-limited JSON Web Tokens (JWT) using HMAC-SHA256 with cryptographically generated secret rotation.
              </li>
            </ul>

            <h2>4. Role-Based Access Control (RBAC) &amp; Maker-Checker Controls</h2>
            <p>
              To prevent internal fraud and employee collusion within financial operations, Zolo Funds enforces strict
              Segregation of Duties (SoD):
            </p>
            <ul>
              <li><strong>Superadmin (Business Owner / Director):</strong> Full organization configuration, branch provisioning, staff credential assignment, billing management, and policy exception waivers.</li>
              <li><strong>Branch Manager:</strong> Approves field-submitted customer loan applications within authorized lending limits, monitors branch collection targets, and oversees cash handshakes.</li>
              <li><strong>Cashier / Teller:</strong> Manages physical cash drawer, accepts field collection remittances, verifies currency denominations, and executes disbursement payments.</li>
              <li><strong>Field Collection Agent:</strong> Uses the mobile app to record doorstep collections and onboard prospective borrowers along pre-assigned daily routes. Field agents <strong>cannot</strong> edit historical transaction entries, modify loan interest terms, or view organizational P&amp;L ledgers.</li>
              <li><strong>Maker-Checker Dual Authorization:</strong> High-risk financial operations—such as loan sanctions above pre-configured branch thresholds, manual penalty waivers, repayment adjustments, and non-performing asset (NPA) write-offs—mandate dual approval. The user initiating the transaction (Maker) cannot be the user approving it (Checker).</li>
            </ul>

            <h2>5. Immutable Financial Ledger &amp; Anti-Tampering Engine</h2>
            <p>
              Financial trust relies upon absolute ledger integrity. Zolo Funds operates an enterprise-grade <strong>Double-Entry General Ledger Engine</strong>:
            </p>
            <ul>
              <li><strong>Append-Only Records:</strong> Once a loan disbursement, repayment receipt, penalty assessment, or auction distribution is committed, the corresponding journal vouchers are permanent and append-only.</li>
              <li><strong>Zero Direct Deletes:</strong> The platform prohibits direct <code>DELETE</code> or <code>UPDATE</code> operations on posted financial transaction rows. Corrections require explicit compensating journal vouchers (Contra / Reversal entries) accompanied by mandatory auditor remarks.</li>
              <li><strong>Continuous Balance Integrity:</strong> For every debit entry, an equal and offsetting credit entry is verified before committing the transaction. System balances must balance to zero.</li>
              <li><strong>Cryptographic Digital Receipts:</strong> Doorstep repayment receipts generated on field collection devices feature a unique cryptographic receipt sequence hash, preventing receipt forgery or duplicate printing.</li>
            </ul>

            <h2>6. Mobile Application Security (Android ZoloFund App)</h2>
            <p>
              The ZoloFund Android mobile app is specifically engineered for high-security field operations:
            </p>
            <ul>
              <li><strong>Android Keystore Integration:</strong> Biometric authentication (fingerprint and Face Unlock) is handled entirely by the physical hardware enclave of the device. Raw biometric characteristics never leave the phone.</li>
              <li><strong>Zero Local Sensitive Caching:</strong> Sensitive customer identity data, unmasked Aadhaar numbers, and credit details are never persisted in unencrypted local device SQLite databases or shared external directories.</li>
              <li><strong>Secure Camera Pipeline:</strong> Customer KYC photographs and collateral documents captured via the app camera are compressed in-memory and uploaded directly over encrypted TLS 1.3 streams without saving redundant copies to the public device gallery.</li>
              <li><strong>Runtime Integrity Checks:</strong> The mobile APK incorporates root detection, debugger detection, and code obfuscation (R8/ProGuard) to protect against unauthorized reverse engineering and runtime tampering.</li>
            </ul>

            <h2>7. Business Continuity, Automated Backups &amp; Disaster Recovery</h2>
            <p>
              To ensure uninterrupted lending operations and zero data loss, Zolo Funds maintains an aggressive Business Continuity &amp; Disaster Recovery (BCDR) plan:
            </p>
            <ul>
              <li><strong>Point-in-Time Recovery (PITR):</strong> PostgreSQL Write-Ahead Logs (WAL) are streamed continuously to redundant storage, enabling point-in-time state reconstruction down to the second.</li>
              <li><strong>Automated Encrypted Backups:</strong> Full automated database snapshots are executed every 24 hours, encrypted with AES-256, and replicated to a geographically distinct secondary data center.</li>
              <li><strong>Recovery Point Objective (RPO):</strong> <strong>&lt; 15 minutes</strong> (maximum theoretical data exposure in a catastrophic physical infrastructure failure).</li>
              <li><strong>Recovery Time Objective (RTO):</strong> <strong>&lt; 2 hours</strong> (time to restore full production services in a secondary hosting zone).</li>
              <li><strong>Quarterly Restoration Drills:</strong> Backup archives are subjected to scheduled restoration drills every 90 days to verify data completeness and index integrity.</li>
            </ul>

            <h2>8. Infrastructure, Physical Security &amp; Data Residency</h2>
            <p>
              All primary compute clusters, database nodes, and cloud storage volumes utilized by Zolo Funds are hosted within
              state-of-the-art enterprise data centers adhering to:
            </p>
            <ul>
              <li><strong>ISO/IEC 27001:2013</strong> (Information Security Management System)</li>
              <li><strong>SOC 2 Type II</strong> (Service Organization Control - Security, Availability &amp; Confidentiality)</li>
              <li><strong>PCI-DSS Level 1</strong> compliant payment processing through Razorpay</li>
              <li><strong>Physical Data Center Safeguards:</strong> Biometric access controls, 24x7 CCTV monitoring, dual-loop redundant power grids, and automated N+1 fire suppression systems.</li>
              <li><strong>Indian Sovereign Data Residency:</strong> In compliance with the Reserve Bank of India (RBI) Digital Lending Guidelines and the Digital Personal Data Protection Act, 2023, all customer databases and transaction archives reside strictly within the territorial borders of the Republic of India.</li>
            </ul>

            <h2>9. Vulnerability Management &amp; Incident Response</h2>
            <p>We take a proactive stance toward cyber threats and software vulnerabilities:</p>
            <ul>
              <li><strong>Static &amp; Dynamic Code Analysis:</strong> Automated SAST scanners inspect all pull requests for dependency vulnerabilities, SQL injection vectors, cross-site scripting (XSS), and insecure dependencies prior to production deployment.</li>
              <li><strong>Independent Penetration Testing:</strong> Our production web endpoints and mobile APIs undergo periodic third-party security audits and penetration tests.</li>
              <li><strong>Incident Response SLA:</strong> In the unlikely event of an identified security breach affecting personal data, Zolo Funds maintains a dedicated Cyber Incident Response Team (CIRT) committed to:
                <ul>
                  <li>Containing and isolating affected services within <strong>four (4) hours</strong>;</li>
                  <li>Notifying affected Tenant administrators within <strong>twenty-four (24) hours</strong>;</li>
                  <li>Filing mandatory incident disclosures with the Indian Computer Emergency Response Team (CERT-In) in accordance with statutory guidelines.</li>
                </ul>
              </li>
            </ul>

            <h2>10. Responsible Disclosure &amp; Security Contact</h2>
            <p>
              We welcome reports from independent cybersecurity researchers, ethical hackers, and subscribers. If you identify a potential security
              vulnerability or misconfiguration, please notify our engineering team responsibly:
            </p>
            <div className="mk-legal-callout">
              <b>Security &amp; Vulnerability Response Desk:</b> Zolo Funds Security Team<br />
              <b>Entity:</b> Zolo Funds (India) Technologies Private Limited<br />
              <b>Corporate Office:</b> 155, Animazon, Narayana Valasu, Nasiyanur Road, Erode - 638011, Tamil Nadu, India<br />
              <b>Dedicated Email:</b> <a href="mailto:security@zolofunds.com" style={{ color: 'var(--mk-primary)', fontWeight: 700 }}>security@zolofunds.com</a><br />
              <b>Security Helpline:</b> +91 80894 05950<br />
              <b>PGP Key Fingerprint:</b> Available upon request for encrypted communications<br />
              <b>Acknowledgment:</b> Within 24 hours of receipt<br />
              <b>Commitment:</b> We do not initiate legal action against ethical researchers who discover issues in good faith without exfiltrating or modifying customer data.
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
