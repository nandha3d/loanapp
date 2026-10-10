import Link from 'next/link';
import { buildMetadata } from '../_components/seo';
import { BreadcrumbJsonLd } from '../_components/JsonLd';

export const metadata = buildMetadata({
  title: 'Terms of Service | Zolo Funds — Master SaaS Agreement',
  description:
    'Terms of Service and Master SaaS Agreement for the Zolo Funds lending management software platform, multi-tenant portal, and mobile application.',
  path: '/terms',
  keywords: [
    'Zolo Funds terms of service',
    'lending software agreement',
    'SaaS license terms India',
    'microfinance software terms',
  ],
});

export default function TermsOfServicePage() {
  const lastUpdated = 'October 10, 2026';

  return (
    <>
      <BreadcrumbJsonLd name="Terms of Service" path="/terms" />

      <section className="mk-pagehero">
        <div className="mk-container">
          <span className="mk-eyebrow">Legal & Compliance</span>
          <h1 className="mk-h1">Terms of Service</h1>
          <p className="mk-lead">
            Master Software-as-a-Service (SaaS) Agreement governing the use of the Zolo Funds
            platform, web portal, APIs, and mobile applications.
          </p>
        </div>
      </section>

      <section className="mk-section mk-section--soft">
        <div className="mk-container">
          <article className="mk-legal">
            <div className="mk-legal-badge">Master Subscription Agreement</div>

            <div className="mk-legal-meta">
              <div><b>Entity:</b> Zolo Funds (India) Technologies Private Limited</div>
              <div><b>Governing Law:</b> Republic of India (Jurisdiction: Chennai, Tamil Nadu)</div>
              <div><b>Effective Date:</b> January 1, 2026</div>
              <div><b>Last Updated:</b> {lastUpdated}</div>
            </div>

            <div className="mk-legal-callout mk-legal-callout--alert">
              <strong>Crucial Notice — Non-Lender Status & Regulatory Allocation:</strong>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                Zolo Funds is strictly a software and technology infrastructure vendor. <strong>Zolo Funds is NOT a Lender, Bank,
                or Non-Banking Financial Company (NBFC).</strong> We do not offer loans, provide guarantees, hold customer deposits,
                or participate in credit decisioning. The subscribing business (&quot;Tenant&quot; or &quot;Customer&quot;) represents and warrants
                that it operates in full compliance with all applicable Reserve Bank of India (RBI) regulations, Money Lending Acts,
                Chit Funds Act (1982), and state laws governing its financial operations.
              </p>
            </div>

            <h2>1. Agreement to Terms</h2>
            <p>
              By registering an account, purchasing a subscription plan, accessing our web portal (<Link href="https://zolofunds.com" style={{ color: 'var(--mk-primary)' }}>https://zolofunds.com</Link>),
              or downloading and using the ZoloFund Android mobile application, you agree to be bound by these Terms of Service
              (&quot;Terms&quot;) and our <Link href="/privacy" style={{ color: 'var(--mk-primary)', textDecoration: 'underline' }}>Privacy Policy</Link>.
              If you are accepting on behalf of a company, partnership, or financial institution, you represent and warrant that you
              have full corporate authority to bind that legal entity.
            </p>

            <h2>2. License Grant & Permitted Use</h2>
            <p>
              Subject to timely payment of subscription fees and compliance with these Terms, Zolo Funds grants you a non-exclusive,
              non-transferable, revocable license to access and use the platform modules selected in your subscription plan:
            </p>
            <ul>
              <li><strong>Micro Lending:</strong> Daily/weekly/monthly loan underwriting, EMI calculation, and field collection tracking.</li>
              <li><strong>Auto Finance:</strong> Vehicle loan scheduling, hypothecation management, and hire purchase (HP) contracts.</li>
              <li><strong>Gold Loans:</strong> Gold ornament appraisal, purity/weight tracking, and bullet interest collection.</li>
              <li><strong>Chit Funds:</strong> Group management, auction management, dividend distribution, and foreman commissions per the Chit Funds Act, 1982.</li>
            </ul>

            <h2>3. Tenant Responsibilities & Regulatory Compliance</h2>
            <p>The subscribing business agrees to and shall be solely responsible for:</p>
            <ul>
              <li><strong>Legal Authority to Lend:</strong> Maintaining all required money lending licenses, NBFC registration, or state approvals required to conduct lending or chit fund operations.</li>
              <li><strong>RBI Fair Practices Code:</strong> Ensuring that all interest rates, overdue penalties, and recovery practices comply with RBI guidelines and state money lending ceilings.</li>
              <li><strong>Field Agent Conduct:</strong> Ensuring field collection agents adhere to ethical recovery practices. Zolo Funds explicitly disclaims any liability for misconduct or unauthorized acts committed by field agents.</li>
              <li><strong>Borrower Consent:</strong> Securing all necessary borrower consents under the Digital Personal Data Protection Act, 2023 prior to uploading borrower data, Aadhaar details, or contact numbers into the platform.</li>
            </ul>

            <h2>4. User Accounts, Security & Dual Authorization</h2>
            <ul>
              <li>You are responsible for maintaining the confidentiality of all user credentials, PINs, and two-factor tokens.</li>
              <li>You must immediately notify us of any suspected breach, compromised device, or unauthorized login.</li>
              <li>Dual authorization (maker-checker) and approval limits configured in the admin portal must be actively reviewed and managed by your organization&apos;s Superadmin.</li>
            </ul>

            <h2>5. Fees, Invoicing & Payment Terms (Razorpay)</h2>
            <ul>
              <li><strong>Subscription Plans:</strong> Plans are billed on a recurring monthly or annual basis as detailed on our <Link href="/pricing" style={{ color: 'var(--mk-primary)' }}>Pricing Page</Link>.</li>
              <li><strong>Payment Processing:</strong> Online payments are processed securely via Razorpay. By subscribing, you authorize automatic recurring debits for the agreed subscription amount.</li>
              <li><strong>Taxes:</strong> All fees are exclusive of applicable Indian Goods and Services Tax (GST 18%), which will be charged and reflected on official tax invoices.</li>
              <li><strong>Failed Payments:</strong> In the event of a failed recurring transaction, a grace period of 7 calendar days is provided before access to administrative functions is suspended.</li>
            </ul>

            <h2>6. Prohibited Activities</h2>
            <p>You agree NOT to:</p>
            <ul>
              <li>Reverse engineer, decompile, or disassemble any part of the platform, API, or Android mobile APK.</li>
              <li>Use the platform for any illegal lending activity, extortion, unauthorized hawala, or anti-money laundering (AML) violations.</li>
              <li>Attempt to bypass tenant scoping, access another organization&apos;s data, or conduct vulnerability scanning without prior written consent.</li>
              <li>Resell, white-label, or sub-license the software to third parties without an authorized Enterprise Partner Agreement.</li>
            </ul>

            <h2>7. Data Ownership & Intellectual Property</h2>
            <ul>
              <li><strong>Your Data:</strong> All borrower records, collection numbers, branch accounts, and financial reports uploaded by you remain your sole property (&quot;Customer Data&quot;).</li>
              <li><strong>Our Platform:</strong> All intellectual property rights, trademarks, UI code, algorithms, database schemas, and documentation are the exclusive property of Zolo Funds (India) Technologies Private Limited.</li>
            </ul>

            <h2>8. Service Availability & Support SLA</h2>
            <p>
              We target a <strong>99.9% uptime</strong> for our cloud API and database infrastructure, excluding scheduled maintenance
              conducted during low-traffic hours (Sundays between 01:00 AM – 04:00 AM IST). Support is provided in English and regional
              Indian languages (Tamil, Hindi, Telugu, Kannada, Malayalam) Monday to Saturday, 09:00 AM to 07:00 PM IST.
            </p>

            <h2>9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by Indian law, Zolo Funds shall not be liable for any indirect, incidental, punitive, or
              consequential damages, including loss of profits, collection shortfalls, borrower defaults, or loan losses. Our total
              aggregate liability arising out of or related to this agreement shall not exceed the total fees paid by you to Zolo Funds
              in the three (3) months preceding the incident.
            </p>

            <h2>10. Termination</h2>
            <ul>
              <li><strong>By Tenant:</strong> You may cancel your subscription at any time through the Billing tab in the Superadmin Portal. Cancellation takes effect at the end of the current paid billing period.</li>
              <li><strong>By Zolo Funds:</strong> We may terminate or suspend access immediately if you violate these Terms, engage in unlawful financial operations, or fail to cure payment defaults after notice.</li>
              <li><strong>Data Export on Exit:</strong> Upon termination, you will be provided a 14-day window to export all your Customer Data in standard Excel/JSON formats before permanent data archiving.</li>
            </ul>

            <h2>11. Governing Law & Dispute Resolution</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of India. Any dispute, controversy, or claim
              arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the competent courts in
              <strong> Chennai, Tamil Nadu, India</strong>.
            </p>

            <h2>12. Contact Information</h2>
            <p>For questions or notices regarding these Terms, contact our legal desk:</p>
            <div className="mk-legal-callout">
              <b>Legal Desk:</b> Zolo Funds (India) Technologies Private Limited<br />
              <b>Address:</b> Anna Salai, Chennai, Tamil Nadu 600002, India<br />
              <b>Email:</b> <a href="mailto:support@zolofunds.com" style={{ color: 'var(--mk-primary)' }}>support@zolofunds.com</a> / <a href="mailto:contact@zolofunds.com" style={{ color: 'var(--mk-primary)' }}>contact@zolofunds.com</a>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
