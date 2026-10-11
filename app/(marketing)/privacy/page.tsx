import { LEGAL } from '@/lib/legalEntity';
import Link from 'next/link';
import { buildMetadata } from '../_components/seo';
import { BreadcrumbJsonLd } from '../_components/JsonLd';

export const metadata = buildMetadata({
  title: 'Privacy Policy | Zolo Funds — Data Safety, Permissions & DPDP Compliance',
  description:
    'Privacy Policy for the Zolo Funds web platform and the ZoloFund Android app, covering the DPDP Act 2023, IT Act 2000 and Google Play User Data policy.',
  path: '/privacy',
  keywords: [
    'Zolo Funds privacy policy',
    'fintech data protection India',
    'DPDP Act 2023 compliance',
    'Google Play loan app policy',
    'Android location permissions lending app',
    'microfinance privacy policy India',
    'RBI digital lending data privacy',
  ],
});

export default function PrivacyPolicyPage() {
  const lastUpdated = 'October 11, 2026';

  return (
    <>
      <BreadcrumbJsonLd name="Privacy Policy" path="/privacy" />

      <section className="mk-pagehero">
        <div className="mk-container">
          <span className="mk-eyebrow">Legal & Compliance</span>
          <h1 className="mk-h1">Privacy Policy</h1>
          <p className="mk-lead">
            Comprehensive data protection, mobile application permissions disclosures, and privacy practices
            for the Zolo Funds lending operating system, cloud APIs, and Android mobile application.
          </p>
        </div>
      </section>

      <section className="mk-section mk-section--soft">
        <div className="mk-container">
          <article className="mk-legal">
            <div className="mk-legal-badge">DPDP Act 2023 &middot; IT Act 2000 &middot; Google Play User Data policy</div>

            <div className="mk-legal-meta">
              <div><b>Operated by:</b> {LEGAL.operator}</div>
              <div><b>Udyam Registration:</b> {LEGAL.udyam}</div>
              <div><b>Effective Date:</b> January 1, 2026</div>
              <div><b>Last Updated:</b> {lastUpdated}</div>
              <div><b>Jurisdiction:</b> Republic of India (Governed by DPDP Act 2023 &amp; IT Act 2000)</div>
              <div><b>Applicable Platforms:</b> Web (<Link href="https://zolofunds.com" style={{ color: 'var(--mk-primary)' }}>zolofunds.com</Link>, <Link href="https://app.zolofunds.com" style={{ color: 'var(--mk-primary)' }}>app.zolofunds.com</Link>) &amp; Android App (ZoloFund)</div>
            </div>

            <div className="mk-legal-callout mk-legal-callout--alert">
              <strong>MANDATORY REGULATORY NOTICE &amp; NON-LENDER STATUS DISCLAIMER:</strong>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                {LEGAL.product}, operated by {LEGAL.operator} (&quot;Zolo Funds&quot;, &quot;we&quot;), is strictly a software and technology infrastructure provider
                (Technology Service Provider / Lending SaaS). <strong>Zolo Funds IS NOT A BANK, NON-BANKING FINANCIAL COMPANY (NBFC), HOUSING FINANCE COMPANY, OR DIRECT MONEY LENDER.</strong>
                We do not solicit loans from the public, disburse money from our own balance sheet, underwrite individual credit decisions, or collect
                interest for our own account. All loan products, underwriting rules, interest rates, sanctions, and recovery decisions are originated
                exclusively by independent registered financial entities, NBFCs, microfinance institutions, or money lending firms (&quot;Lenders&quot; or
                &quot;Tenants&quot;) that license our software.
              </p>
            </div>

            <h2>1. Introduction &amp; Statutory Regulatory Framework</h2>
            <p>
              This Privacy Policy explains how Zolo Funds collects, processes, stores, protects, and discloses personal data and financial information
              when you access our websites, subscribe to our cloud services, or utilize our mobile applications. This policy has been drafted in strict
              accordance with the following Indian and international statutory standards:
            </p>
            <ul>
              <li><strong>The Digital Personal Data Protection Act, 2023 (DPDP Act, 2023)</strong> and statutory rules framed thereunder;</li>
              <li><strong>The Information Technology Act, 2000</strong>, including Section 43A (compensation for failure to protect data) and Section 72A (punishment for disclosure of information in breach of lawful contract);</li>
              <li><strong>The Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 (SPDI Rules)</strong>;</li>
              <li><strong>The Reserve Bank of India (RBI) Guidelines on Digital Lending (2022)</strong> as applicable to Lending Service Providers (LSPs) and Technology Service Providers (TSPs);</li>
              <li><strong>The Aadhaar (Targeted Delivery of Financial and Other Subsidies, Benefits and Services) Act, 2016</strong> and UIDAI Circulars on masking and offline KYC;</li>
              <li><strong>Google Play Developer Program Policies</strong>, including the User Data policy and Data safety disclosures.</li>
            </ul>

            <h2>2. Definitions Under This Policy</h2>
            <ul>
              <li><strong>&quot;Data Principal&quot;:</strong> The individual to whom the personal data relates (including subscribing business administrators, loan officers, field collection agents, and end borrowers).</li>
              <li><strong>&quot;Data Fiduciary&quot;:</strong> The entity that determines the purpose and means of the processing of personal data. The subscribing Lender acts as the Data Fiduciary for borrower records; Zolo Funds acts as the Data Fiduciary for administrative account holders.</li>
              <li><strong>&quot;Data Processor&quot;:</strong> Any entity that processes personal data on behalf of a Data Fiduciary. Zolo Funds acts as a Data Processor regarding borrower data uploaded by subscribing Lenders.</li>
              <li><strong>&quot;Lender&quot; / &quot;Tenant&quot;:</strong> The business entity (NBFC, MFI, financier, chit fund manager) holding a valid subscription license on Zolo Funds.</li>
              <li><strong>&quot;Borrower&quot;:</strong> An individual or commercial entity that has applied for, received, or is servicing a loan issued by a subscribing Lender.</li>
              <li><strong>&quot;Personal Data&quot;:</strong> Any data about an individual who is identifiable by or in relation to such data.</li>
              <li><strong>&quot;Sensitive Personal Data&quot;:</strong> Passwords, financial information (bank accounts, payment instrument details), and biometric identifiers.</li>
            </ul>

            <h2>3. Categories of Data Collected</h2>
            <h3>A. Subscribing Business &amp; Staff Data (Direct Collection)</h3>
            <p>When an organization registers a tenant account or configures staff logins, we collect:</p>
            <ul>
              <li><strong>Subscriber Identity Data:</strong> Full legal name, official email address, mobile phone number, date of birth, and encrypted authentication credentials.</li>
              <li><strong>Business &amp; Tax Identifiers:</strong> Legal entity name, trade name, registered corporate address, GSTIN, PAN, and certificate of incorporation / money lending license references.</li>
              <li><strong>Billing &amp; Subscription Records:</strong> Subscription tier, add-on modules, billing address, and transaction identifiers generated via authorized gateways (Razorpay). We do not record or retain raw credit card CVVs or net banking passwords.</li>
            </ul>

            <h3>B. Borrower &amp; Loan Data (Processed on Behalf of Lenders)</h3>
            <p>Lenders utilize our multi-tenant database to manage their loan portfolios. Such data is uploaded by the Lender or collected via field agent applications:</p>
            <ul>
              <li><strong>Borrower Profile:</strong> Full legal name, father&apos;s/spouse&apos;s name, residential address, mobile phone number, alternate emergency contact, and profile photograph.</li>
              <li><strong>KYC Documents:</strong> PAN number, Aadhaar number (stored encrypted with AES-256-GCM and shown masked in the app), Aadhaar e-KYC details returned through our KYC partner when the lender uses Aadhaar OTP (name, date of birth, address, photo), and voter ID or driving licence images. Biometric templates (fingerprint/iris) are never collected.</li>
              <li><strong>Loan Particulars:</strong> Loan account number, principal sanctioned, interest rate, disbursement date, repayment schedule (daily, weekly, monthly), EMI installment breakdown, penalty charges, and outstanding balances.</li>
              <li><strong>Module-Specific Collateral Records:</strong>
                <ul>
                  <li><em>Auto Finance:</em> Vehicle registration number, chassis number, engine number, make, model, insurance policy expiry date, hypothecation status, and co-applicant details.</li>
                  <li><em>Gold Loans:</em> Ornament itemization (bangles, chains, rings), gross weight, net weight, stone deduction, karat purity (22K, 18K), appraised valuation, and secure vault packet identifier.</li>
                  <li><em>Chit Funds:</em> Chit group identifier, ticket number, monthly installment, auction bidding logs, prize distribution amount, dividend allocations, and guarantor details.</li>
                </ul>
              </li>
            </ul>

            <h3>C. Device Telemetry &amp; Technical Audit Data</h3>
            <p>When accessing our web portals or Android mobile application, our systems record:</p>
            <ul>
              <li><strong>Technical Identifiers:</strong> IP address, device hardware model, Android OS version, unique app installation UUID, browser user-agent, and mobile network operator.</li>
              <li><strong>Audit Timestamps:</strong> Exact login timestamps, failed authentication attempts, collection synchronization intervals, and API request latency.</li>
            </ul>

            <h2>4. Android Mobile Application Permissions (Google Play Store Disclosure)</h2>
            <p>
              The ZoloFund Android app is used by the staff of lending businesses (owners, branch managers and field collection agents). It does not
              offer loans to consumers. Every permission the app requests is listed below with its purpose:
            </p>

            <table className="mk-legal-table">
              <thead>
                <tr>
                  <th>Android System Permission</th>
                  <th>Core Feature / Use Case</th>
                  <th>Data Access &amp; Storage Policy</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>ACCESS_FINE_LOCATION &amp; ACCESS_COARSE_LOCATION</strong></td>
                  <td>GPS Collection Verification &amp; Fraud Prevention</td>
                  <td>
                    Used while the app is open. When a field officer records a collection or a customer visit, the latitude, longitude, accuracy and
                    time are saved with the record so the business can confirm the visit really happened. While the collection route screen is open,
                    the app also sends the officer&apos;s location about every 30 seconds so the office can follow route progress; this stops when the
                    screen is closed. Readings from fake-GPS apps are flagged. The ZoloFund app does <strong>not</strong> collect location in the background.
                  </td>
                </tr>
                <tr>
                  <td><strong>CAMERA</strong></td>
                  <td>KYC Document Digitization &amp; Borrower Verification</td>
                  <td>
                    Used to photograph customers, KYC documents and collateral, and to scan payment QR codes. Images are compressed on the device and uploaded
                    over HTTPS (TLS 1.2 or higher). Face detection (to frame customer photos) and QR scanning run on the device using Google ML Kit; no face
                    data is sent to our servers beyond the photo itself.
                  </td>
                </tr>
                <tr>
                  <td><strong>RECORD_AUDIO</strong></td>
                  <td>Voice-Assisted Collection Entry (Speech-to-Text)</td>
                  <td>
                    Enables collection officers to speak customer names or installment amounts into the field run sheet (hands-free entry).
                    Audio goes only to the phone&apos;s speech-recognition service (on the device or Google&apos;s, depending on the phone) while voice entry is active;
                    the app receives text only. <strong>ZoloFund never records, stores or uploads audio.</strong>
                  </td>
                </tr>
                <tr>
                  <td><strong>READ_MEDIA_IMAGES / READ_EXTERNAL_STORAGE</strong></td>
                  <td>Receipt PDF Sharing &amp; Document Upload</td>
                  <td>
                    Enables field officers to save digital PDF repayment receipts to the device storage and select customer collateral photos from the gallery.
                    The app does not access, scan, or index unrelated private media.
                  </td>
                </tr>
                <tr>
                  <td><strong>USE_BIOMETRIC</strong></td>
                  <td>Biometric Application Lock</td>
                  <td>
                    Allows loan officers to unlock the app using fingerprint or Face ID. <strong>Biometric authentication is handled entirely by Android Keystore on the physical hardware enclave.</strong>
                    Raw biometric templates are never transmitted to Zolo Funds servers.
                  </td>
                </tr>
                <tr>
                  <td><strong>POST_NOTIFICATIONS</strong></td>
                  <td>Transactional &amp; Operational Alerts</td>
                  <td>
                    Delivers real-time notifications for pending loan approvals, overdue bucket transitions, cash float remittances, and collection receipts.
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mk-legal-callout">
              <strong>EXPLICIT NEGATIVE DISCLOSURE — RESTRICTED PERMISSIONS NOT ACCESSED:</strong>
              <p style={{ marginTop: 6, marginBottom: 0 }}>
                In compliance with Google Play Store Financial Services Policy, the ZoloFund Android app <strong>DOES NOT</strong> request, access, or collect:
                <br />• <strong>READ_CONTACTS:</strong> We never access or exfiltrate your address book or borrower contact lists.
                <br />• <strong>READ_CALL_LOG:</strong> We never inspect your incoming or outgoing call logs.
                <br />• <strong>READ_SMS:</strong> We never read personal text messages or banking SMS notifications.
                <br />• <strong>ACCESS_MEDIA_LOCATION:</strong> We do not scan EXIF metadata from unrelated personal photos.
              </p>
            </div>

            <h2>5. Lawful Bases for Processing Under DPDP Act 2023</h2>
            <p>Zolo Funds processes personal data strictly under valid lawful bases established in Indian law:</p>
            <ul>
              <li><strong>Consent (Section 6, DPDP Act):</strong> Subscribing organizations and administrative users provide explicit, informed consent upon registration. Lenders represent and warrant that they have secured valid consent from their borrowers prior to entering data into the platform.</li>
              <li><strong>Legitimate Uses &amp; Contract Performance (Section 7, DPDP Act):</strong> Processing necessary to fulfill our software subscription agreement, issue invoices, maintain database integrity, and calculate mathematical loan schedules.</li>
              <li><strong>Statutory Compliance:</strong> Compliance with directives issued by the Reserve Bank of India, Prevention of Money Laundering Act (PMLA 2002), and Indian tax authorities.</li>
            </ul>

            <h2>6. Absolute Zero-Sale &amp; Anti-Brokering Commitment</h2>
            <div className="mk-legal-callout mk-legal-callout--alert">
              <strong>Our Binding Privacy Commitment:</strong>
              <p style={{ marginTop: 6, marginBottom: 0 }}>
                Zolo Funds <strong>DOES NOT sell, trade, rent, monetize, or broker personal data</strong> to third-party data brokers, advertising
                aggregators, telemarketers or marketing networks. Your data belongs to your organization and is processed only to provide the software features
                you use. When a lender runs a credit check, the borrower details needed for that check (name, PAN, date of birth, address, mobile) are sent to
                the credit bureau the lender uses. This is part of the service the lender requests, not a sale of data.
              </p>
            </div>

            <h2>7. Third-Party Sub-Processors &amp; Infrastructure Partners</h2>
            <p>We use the following service providers. Some are used only when a lender turns the feature on:</p>
            <ul>
              <li><strong>Firebase Cloud Messaging (Google LLC):</strong> Real-time push notification delivery to Android smartphones.</li>
              <li><strong>Razorpay Software Private Limited:</strong> PCI-DSS Level 1 certified payment gateway facilitating subscription billing for software plans.</li>
              <li><strong>Hostinger International Ltd:</strong> virtual private server hosting our application and database in Mumbai, India.</li>
              <li><strong>Digio Internet Pvt Ltd:</strong> Aadhaar OTP e-KYC and video KYC, when the lender enables KYC.</li>
              <li><strong>CRIF High Mark and TransUnion CIBIL:</strong> credit reports, when the lender runs a bureau check.</li>
              <li><strong>Google LLC:</strong> Google Sign-In (optional login), Firebase Cloud Messaging (push notifications) and on-device ML Kit (photo framing, QR scanning).</li>
              <li><strong>Map tile provider:</strong> map images in the app and portal; the provider sees the device IP address and the map area being viewed.</li>
              <li><strong>Meta WhatsApp Business Cloud API:</strong> Optional transactional messaging service used to send digital repayment receipts and overdue alerts directly to borrowers upon Lender configuration.</li>
              <li><strong>MSG91 / Telemark Telecom Services:</strong> Optional DLT-registered SMS gateway for dispatching OTPs and payment acknowledgments.</li>
            </ul>

            <h2>8. Data Security &amp; Cryptographic Standards</h2>
            <p>Zolo Funds maintains enterprise-grade technical and organizational security controls:</p>
            <ul>
              <li><strong>Multi-Tenant Database Scoping:</strong> Logical separation enforced at the ORM and SQL boundary ensuring that Tenant A cannot access, query, or alter data belonging to Tenant B.</li>
              <li><strong>Encryption in transit:</strong> all web and API traffic uses HTTPS (TLS 1.2 or 1.3) with HTTP Strict Transport Security (HSTS).</li>
              <li><strong>Encryption of sensitive fields:</strong> Aadhaar numbers and integration credentials (API keys, payment-gateway secrets) are encrypted in the database with AES-256-GCM.</li>
              <li><strong>Password Security:</strong> User passwords are one-way hashed using salted bcrypt and cannot be read or retrieved in plaintext by administrators or software engineers.</li>
              <li><strong>Immutable Audit Trails:</strong> Financial entries (disbursements, repayments, waivers, write-offs) are append-only. Silent deletion or editing of financial records is blocked at the software engine level.</li>
            </ul>

            <h2>9. Data Retention &amp; Archival Schedules</h2>
            <p>Data retention follows strict operational and statutory schedules:</p>
            <ul>
              <li><strong>Active Subscription Period:</strong> Data remains accessible throughout the active term of the subscription agreement.</li>
              <li><strong>Statutory Financial Records:</strong> Financial ledgers, repayment logs, customer sanction notes, and collection receipts must be preserved for <strong>up to eight (8) years</strong> following loan settlement pursuant to the Prevention of Money Laundering Act, 2002 and Income Tax rules.</li>
              <li><strong>Ephemeral Technical Logs:</strong> Web server access logs, IP traces, and routing records are retained for 180 days in compliance with Indian Computer Emergency Response Team (CERT-In) directives, after which they are automatically purged.</li>
            </ul>

            <h2 id="data-deletion">10. Rights of the Data Principal &amp; Account Deletion Protocol</h2>
            <p>Under the DPDP Act 2023 and Google Play Store policies, Data Principals possess the following enforceable rights:</p>
            <ul>
              <li><strong>Right to Access:</strong> The right to obtain a summary of personal data being processed.</li>
              <li><strong>Right to Correction &amp; Updating:</strong> The right to correct inaccurate or misleading personal information.</li>
              <li><strong>Right to Erasure (Account Deletion):</strong> The right to request the permanent deletion of user accounts and personal identifiers.</li>
              <li><strong>Right to Grievance Redressal:</strong> The right to readily available grievance redressal mechanisms with defined resolution timelines.</li>
              <li><strong>Right to Nominate:</strong> The right to designate a nominee in the event of death or incapacity.</li>
            </ul>

            <h3>Google Play Store Account Deletion Procedure:</h3>
            <p>
              Users may initiate account deletion at any time without fee or penalty:
            </p>
            <ol>
              <li><strong>Dedicated Deletion Portal:</strong> Visit our public <Link href="/delete-account" style={{ color: 'var(--mk-primary)', fontWeight: 700 }}>Data &amp; Account Deletion Request Portal (/delete-account)</Link>.</li>
              <li><strong>In-App Settings:</strong> Navigate to <strong>Settings → Request Account Deletion</strong> in the ZoloFund Android application.</li>
              <li><strong>Email Verification:</strong> Send an email from your registered email address to <a href="mailto:support@zolofunds.com" style={{ color: 'var(--mk-primary)', fontWeight: 600 }}>support@zolofunds.com</a> with the subject line <em>&quot;Account Deletion Request&quot;</em>.</li>
            </ol>
            <p>
              <strong>Processing Window:</strong> User authentication credentials, login sessions, mobile device tokens, and personal contact identifiers
              are permanently wiped within <strong>seven (7) business days</strong> of identity confirmation. Non-personal historical financial ledgers
              are archived in anonymized form to comply with statutory audit mandates.
            </p>

            <h2>11. Cross-Border Data Transfer &amp; Indian Data Residency</h2>
            <p>
              In compliance with Indian data sovereignty principles and RBI digital lending directives, all primary customer databases, loan ledgers,
              and KYC archives are stored and processed on servers located <strong>in India (Mumbai)</strong>. Some providers in section 7 (for example Google,
              for push notifications) may process limited data, such as device push tokens, outside India.
            </p>

            <h2>12. Protection of Children&apos;s Privacy</h2>
            <p>
              The Zolo Funds platform and Android application are designed exclusively for commercial financial operations and adult borrowers. We do
              not knowingly solicit or collect data from minors under eighteen (18) years of age. If we discover that personal data of a minor has been
              inadvertently collected without verified parental consent, we will take immediate steps to delete such data.
            </p>

            <h2>13. Grievance Redressal Mechanism &amp; Officer Details</h2>
            <p>
              In accordance with Section 12 of the DPDP Act 2023 and the Information Technology Act, 2000, any questions, grievances, or disputes
              regarding data privacy should be addressed to our designated Grievance Officer:
            </p>
            <div className="mk-legal-callout">
              <b>Grievance Officer:</b> {LEGAL.grievanceOfficer}<br />
              <b>Entity:</b> {LEGAL.operator}<br />
              <b>Office:</b> {LEGAL.address}<br />
              <b>Udyam Registration:</b> {LEGAL.udyam}<br />
              <b>Dedicated Email:</b> <a href="mailto:grievance@zolofunds.com" style={{ color: 'var(--mk-primary)', fontWeight: 700 }}>grievance@zolofunds.com</a><br />
              <b>Support Email:</b> <a href="mailto:support@zolofunds.com" style={{ color: 'var(--mk-primary)', fontWeight: 700 }}>support@zolofunds.com</a><br />
              <b>Helpline:</b> +91 80894 05950 (Mon–Sat, 09:30 AM to 06:30 PM IST)<br />
              <b>Acknowledgment:</b> Within twenty-four (24) hours of receipt.<br />
              <b>Resolution SLA:</b> Within fifteen (15) business days.
            </div>

            <h2>14. Amendments to This Policy</h2>
            <p>
              We reserve the right to revise this Privacy Policy to accommodate legislative amendments, technological evolutions, or app store policy
              updates. Notice of material modifications will be delivered via email to registered tenant administrators and highlighted on the portal
              dashboard at least thirty (30) days prior to implementation. Continued use of our software constitutes acceptance of the amended policy.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
