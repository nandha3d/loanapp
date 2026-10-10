import Link from 'next/link';
import { buildMetadata } from '../_components/seo';
import { BreadcrumbJsonLd } from '../_components/JsonLd';

export const metadata = buildMetadata({
  title: 'Privacy Policy | Zolo Funds — Data Safety & Play Store Disclosures',
  description:
    'Official Privacy Policy for Zolo Funds web platform and Android mobile application. Compliant with Digital Personal Data Protection Act (DPDP Act 2023), IT Act 2000, and Google Play Store Financial Services Policy.',
  path: '/privacy',
  keywords: [
    'Zolo Funds privacy policy',
    'loan software data protection',
    'DPDP Act compliance',
    'Google Play loan app policy',
    'microfinance privacy policy India',
  ],
});

export default function PrivacyPolicyPage() {
  const lastUpdated = 'October 10, 2026';

  return (
    <>
      <BreadcrumbJsonLd name="Privacy Policy" path="/privacy" />

      <section className="mk-pagehero">
        <div className="mk-container">
          <span className="mk-eyebrow">Legal & Compliance</span>
          <h1 className="mk-h1">Privacy Policy</h1>
          <p className="mk-lead">
            Transparent data safety, mobile app permissions disclosure, and privacy practices
            for the Zolo Funds lending operating system and mobile application.
          </p>
        </div>
      </section>

      <section className="mk-section mk-section--soft">
        <div className="mk-container">
          <article className="mk-legal">
            <div className="mk-legal-badge">Google Play Store & DPDP Act (India) Compliant</div>

            <div className="mk-legal-meta">
              <div><b>Entity:</b> Zolo Funds (India) Technologies Private Limited</div>
              <div><b>Effective Date:</b> January 1, 2026</div>
              <div><b>Last Updated:</b> {lastUpdated}</div>
              <div><b>Applicable Platforms:</b> Web (zolofunds.com), Android App (ZoloFund)</div>
            </div>

            <div className="mk-legal-callout mk-legal-callout--alert">
              <strong>Important Regulatory Notice & Non-Lending Disclosure:</strong>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                Zolo Funds is a business-to-business (B2B) financial technology software provider (Lending SaaS).
                <strong> Zolo Funds is NOT a Bank, Non-Banking Financial Company (NBFC), or money lender.</strong> We do
                not lend money, solicit loan applications, make credit underwriting decisions, or charge interest directly
                to consumers. All loan products, interest rates, approvals, and disbursement agreements are created and
                managed by independent financial entities, NBFCs, or registered microfinance institutions (&quot;Lenders&quot; or
                &quot;Tenants&quot;) that license our software.
              </p>
            </div>

            <h2>1. Introduction & Overview</h2>
            <p>
              Zolo Funds (India) Technologies Private Limited (&quot;Zolo Funds&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) respect your privacy
              and are committed to protecting the personal data of our users, subscribing organizations, and their authorized
              personnel. This Privacy Policy outlines how we collect, store, process, protect, and delete information when you
              use our website (<Link href="https://zolofunds.com" style={{ color: 'var(--mk-primary)', textDecoration: 'underline' }}>https://zolofunds.com</Link>)
              and our Android mobile application (&quot;ZoloFund&quot;).
            </p>
            <p>
              This policy is structured to comply with the <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong>, the
              <strong> Information Technology Act, 2000</strong>, the <strong>Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011</strong>,
              and the <strong>Google Play Store Developer Policies (including Financial Services and Personal Loans Policies)</strong>.
            </p>

            <h2>2. Roles Under the DPDP Act (Data Fiduciary vs. Data Processor)</h2>
            <ul>
              <li>
                <strong>Zolo Funds as Data Fiduciary:</strong> We act as the Data Fiduciary for information regarding our direct
                subscribers (the business owners, admins, and loan officers who register for an account to manage their business).
              </li>
              <li>
                <strong>Zolo Funds as Data Processor:</strong> For borrower and customer data uploaded by subscribing financial
                institutions into our multi-tenant software, the subscribing Lender is the independent Data Fiduciary, and Zolo Funds
                operates strictly as a secure technology Data Processor handling data solely upon the instructions of the Lender.
              </li>
            </ul>

            <h2>3. Information We Collect</h2>
            <p>We only collect information necessary to provide lending management, offline synchronization, and GPS field verification features:</p>
            <h3>A. Information Provided by Subscribing Organizations (Lenders/Admins)</h3>
            <ul>
              <li><strong>Account Credentials:</strong> Full name, official email address, mobile number, organization name, and encrypted passwords.</li>
              <li><strong>Business Details:</strong> Business address, GSTIN, PAN, and tenant configuration settings.</li>
              <li><strong>Payment & Billing Information:</strong> Subscription transaction IDs, billing address, and invoice history (processed securely via PCI-DSS compliant gateways like Razorpay; we never store raw credit/debit card numbers or CVVs).</li>
            </ul>

            <h3>B. Borrower Information Managed by Lenders</h3>
            <p>Subscribing lenders may upload records of their loan customers into the system, including:</p>
            <ul>
              <li>Customer name, contact number, residential address, and occupation.</li>
              <li>KYC identification references (PAN number, masked Aadhaar reference or last 4 digits per UIDAI guidelines).</li>
              <li>Loan account details, principal amount, repayment cadence, EMI schedule, and payment receipt records.</li>
            </ul>

            <h2>4. Android Mobile Application Permissions & Google Play Disclosures</h2>
            <p>
              The ZoloFund Android application requires specific system permissions to facilitate field collection, offline
              receipt printing, and agent verification. In compliance with <strong>Google Play Store Developer Policies</strong>,
              each permission and its explicit purpose is disclosed below:
            </p>

            <table className="mk-legal-table">
              <thead>
                <tr>
                  <th>Android Permission</th>
                  <th>Feature / Purpose</th>
                  <th>How & When Data is Accessed</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>ACCESS_FINE_LOCATION & ACCESS_COARSE_LOCATION</strong></td>
                  <td>GPS Collection Verification & Fraud Prevention</td>
                  <td>
                    Accessed <strong>only</strong> when a field collection officer records a cash collection or onboard a borrower.
                    Geotags the receipt to confirm the agent physically visited the borrower&apos;s shop or home, protecting both borrower
                    and financier against unauthorized phantom collections.
                  </td>
                </tr>
                <tr>
                  <td><strong>ACCESS_BACKGROUND_LOCATION</strong></td>
                  <td>Agent Route & Safety Tracking (Optional)</td>
                  <td>
                    Used strictly while a field collection agent is actively &quot;On Duty&quot; and opted into route management to display
                    daily route progress to branch managers. <strong>Never tracked when the agent is logged off or off-duty.</strong>
                  </td>
                </tr>
                <tr>
                  <td><strong>CAMERA</strong></td>
                  <td>KYC Document Capture & Identity Verification</td>
                  <td>
                    Used to take borrower profile photos and photograph physical loan sanction documents or collateral items.
                    Images are compressed and transmitted securely over encrypted channels.
                  </td>
                </tr>
                <tr>
                  <td><strong>RECORD_AUDIO</strong></td>
                  <td>Voice-Assisted Collection Entry</td>
                  <td>
                    Used exclusively for hands-free speech-to-text input (e.g. speaking a customer loan number or collection amount).
                    Audio is processed in real time and <strong>never recorded ambiently or stored as audio files on our servers.</strong>
                  </td>
                </tr>
                <tr>
                  <td><strong>READ_MEDIA_IMAGES / STORAGE</strong></td>
                  <td>Receipt PDF Sharing & Document Upload</td>
                  <td>
                    Allows field officers to save digital PDF repayment receipts to their phone and upload collateral photos.
                    We do not scan or inspect unrelated private photos on the device.
                  </td>
                </tr>
                <tr>
                  <td><strong>POST_NOTIFICATIONS</strong></td>
                  <td>Collection Reminders & Approval Alerts</td>
                  <td>
                    Delivers real-time alerts for pending loan approvals, loan disbursement confirmations, and daily collection totals.
                  </td>
                </tr>
                <tr>
                  <td><strong>USE_BIOMETRIC</strong></td>
                  <td>Biometric App Lock</td>
                  <td>
                    Enables fingerprint or Face Unlock on device. <strong>Biometric data never leaves the device&apos;s secure hardware enclave</strong>
                    and is never transmitted to Zolo Funds servers.
                  </td>
                </tr>
              </tbody>
            </table>

            <h2>5. Zero Sale of Data Commitment</h2>
            <div className="mk-legal-callout">
              <strong>Strict Non-Commercialization Guarantee:</strong>
              <p style={{ marginTop: 6, marginBottom: 0 }}>
                Zolo Funds <strong>NEVER sells, rents, monetizes, or trades</strong> any personal, financial, borrower, or location
                data to third-party data brokers, advertising networks, or marketing companies. Data is used strictly to provide the
                authorized SaaS operating system services to the subscribing organization.
              </p>
            </div>

            <h2>6. Third-Party Services & SDK Integrations</h2>
            <p>Our platform integrates with trusted, enterprise-grade third-party infrastructure providers:</p>
            <ul>
              <li><strong>Firebase Cloud Messaging (Google LLC):</strong> For transmitting push notifications to Android devices.</li>
              <li><strong>Razorpay Software Private Limited:</strong> For secure payment gateway processing of software subscription fees.</li>
              <li><strong>Supabase Auth:</strong> For optional single-sign-on (Google OAuth) identity verification.</li>
              <li><strong>Hostinger Cloud Infrastructure:</strong> Cloud hosting with ISO 27001 certified physical data centers and Indian edge nodes.</li>
            </ul>

            <h2>7. Data Security & Storage Standards</h2>
            <p>We employ rigorous technical and organizational measures to safeguard all data:</p>
            <ul>
              <li><strong>Encryption in Transit:</strong> All web and mobile communications are encrypted using Transport Layer Security (TLS 1.3 / HTTPS).</li>
              <li><strong>Encryption at Rest:</strong> Database backups and sensitive credentials are encrypted using industry-standard AES-256 encryption.</li>
              <li><strong>Multi-Tenant Isolation:</strong> Data between different lending companies is logically isolated by strict database tenant identifiers, preventing cross-tenant leakage.</li>
              <li><strong>Password Hashing:</strong> Passwords are salt-hashed using bcrypt and are never retrievable in plaintext.</li>
            </ul>

            <h2>8. Data Retention & Statutory Compliance</h2>
            <p>
              We retain account data for the duration of the subscription agreement. In accordance with Indian financial regulations
              (including the Prevention of Money Laundering Act, 2002 and Income Tax regulations), lending accounting records, transaction
              logs, and repayment receipts may be retained for up to 8 years following loan closure for statutory audit purposes.
            </p>

            <h2 id="data-deletion">9. Account & Data Deletion Mechanism (Google Play Requirement)</h2>
            <p>
              In full compliance with <strong>Google Play Store&apos;s Data Deletion Policy</strong> and the <strong>DPDP Act 2023</strong>:
            </p>
            <ul>
              <li>
                <strong>Self-Service Account Deletion:</strong> Any registered user or subscribing organization can submit a formal
                account deletion request directly through our dedicated <Link href="/delete-account" style={{ color: 'var(--mk-primary)', fontWeight: 700 }}>Data & Account Deletion Portal (/delete-account)</Link>.
              </li>
              <li>
                <strong>Email Deletion Request:</strong> You may also email <a href="mailto:support@zolofunds.com" style={{ color: 'var(--mk-primary)', fontWeight: 600 }}>support@zolofunds.com</a> with the subject line <em>&quot;Account Deletion Request&quot;</em> from your registered email address.
              </li>
              <li>
                <strong>Processing Timeline:</strong> User login credentials, authentication tokens, session cookies, and mobile device identifiers are purged within <strong>7 business days</strong> of verified request.
              </li>
              <li>
                <strong>Audit Exception:</strong> Financial ledger transactions already finalized between lenders and borrowers may be retained in anonymized/archived form to satisfy statutory legal audit requirements under Indian law.
              </li>
            </ul>

            <h2>10. Grievance Redressal Officer</h2>
            <p>
              In accordance with the Information Technology Act, 2000 and rules made thereunder, as well as the DPDP Act 2023, the details
              of the Grievance Redressal Officer are as follows:
            </p>
            <div className="mk-legal-callout">
              <b>Grievance Officer:</b> Compliance & Privacy Desk<br />
              <b>Entity:</b> Zolo Funds (India) Technologies Private Limited<br />
              <b>Address:</b> Zolo Funds Tech Hub, Anna Salai, Chennai, Tamil Nadu 600002, India<br />
              <b>Email:</b> <a href="mailto:grievance@zolofunds.com" style={{ color: 'var(--mk-primary)' }}>grievance@zolofunds.com</a> / <a href="mailto:support@zolofunds.com" style={{ color: 'var(--mk-primary)' }}>support@zolofunds.com</a><br />
              <b>Response Window:</b> Acknowledgment within 24 hours; resolution within 15 business days.
            </div>

            <h2>11. Updates to this Policy</h2>
            <p>
              We may update this Privacy Policy periodically to reflect technological, legal, or regulatory updates. Subscribing organizations
              will be notified of material changes via email or an in-app portal notice prior to the change becoming effective.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
