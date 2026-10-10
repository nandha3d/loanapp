import Link from 'next/link';
import { buildMetadata } from '../_components/seo';
import { BreadcrumbJsonLd } from '../_components/JsonLd';

export const metadata = buildMetadata({
  title: 'Cancellation & Refund Policy | Zolo Funds — SaaS Subscriptions',
  description:
    'Comprehensive Cancellation, Subscription Termination, and Refund Policy for Zolo Funds lending operating system subscriptions, add-on modules, and Razorpay billing. Fully compliant with Indian commercial regulations.',
  path: '/refund',
  keywords: [
    'Zolo Funds refund policy',
    'SaaS cancellation policy India',
    'Razorpay subscription refund',
    'lending software billing terms',
    'pro-rata software refund',
    'GST credit note refund policy',
  ],
});

export default function RefundPolicyPage() {
  const lastUpdated = 'October 10, 2026';

  return (
    <>
      <BreadcrumbJsonLd name="Cancellation & Refund Policy" path="/refund" />

      <section className="mk-pagehero">
        <div className="mk-container">
          <span className="mk-eyebrow">Billing & Subscriptions</span>
          <h1 className="mk-h1">Cancellation & Refund Policy</h1>
          <p className="mk-lead">
            Comprehensive commercial guidelines governing subscription cancellations, annual plan
            adjustments, duplicate billing refunds, and Razorpay payment resolutions.
          </p>
        </div>
      </section>

      <section className="mk-section mk-section--soft">
        <div className="mk-container">
          <article className="mk-legal">
            <div className="mk-legal-badge">Razorpay & Indian Commercial Law Compliant</div>

            <div className="mk-legal-meta">
              <div><b>Entity:</b> Zolo Funds (India) Technologies Private Limited</div>
              <div><b>CIN:</b> U72900TN2026PTC158920</div>
              <div><b>Authorized Payment Gateway:</b> Razorpay Software Private Limited</div>
              <div><b>Applicable Products:</b> Zolo Funds Cloud SaaS Subscriptions & Modules</div>
              <div><b>Effective Date:</b> January 1, 2026</div>
              <div><b>Last Updated:</b> {lastUpdated}</div>
            </div>

            <div className="mk-legal-callout mk-legal-callout--alert">
              <strong>COMMERCIAL POLICY HIGHLIGHT:</strong>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                Zolo Funds provides a <strong>14-Day Full-Feature Free Trial</strong> with zero payment card commitment so organizations
                can thoroughly evaluate all lending modules, field collection apps, and accounting ledgers before paying any fees.
                Consequently, recurring subscription fees are generally non-refundable once a billing cycle commences, except in cases of
                verified billing discrepancies, duplicate charges, or statutory cancellation requests detailed in this Policy.
              </p>
            </div>

            <h2>1. Preamble & Scope of Policy</h2>
            <p>
              This Cancellation and Refund Policy (&quot;Policy&quot;) governs all purchases, subscription renewals, module upgrades, and automated
              recurring debits executed on the Zolo Funds software platform (<Link href="https://zolofunds.com" style={{ color: 'var(--mk-primary)' }}>https://zolofunds.com</Link> and <Link href="https://app.zolofunds.com" style={{ color: 'var(--mk-primary)' }}>https://app.zolofunds.com</Link>),
              operated by <strong>Zolo Funds (India) Technologies Private Limited</strong> (&quot;Zolo Funds&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
            </p>
            <p>
              By subscribing to any software tier (Starter, Growth, Scale, or Enterprise) or purchasing add-on capabilities (such as additional field agent seats,
              branch packs, or specialized vertical modules), the subscribing organization (&quot;Tenant&quot;, &quot;Subscriber&quot;, &quot;you&quot;)
              expressly agrees to the terms and procedures outlined herein.
            </p>

            <h2>2. 14-Day Risk-Free Trial Period</h2>
            <p>
              To ensure that every financier, microfinance institution, gold loan provider, or chit fund operator can confirm that Zolo Funds meets
              their exact operational and accounting requirements, we offer an unconditional free trial:
            </p>
            <ul>
              <li><strong>Zero Payment Details Required:</strong> No credit card, debit card, UPI mandate, or bank account authorization is collected to begin the trial.</li>
              <li><strong>Full Feature Availability:</strong> Trial accounts receive unrestricted access to loan origination, schedule generation, Android field agent APK, day-book ledgers, and reporting engines.</li>
              <li><strong>Zero Automatic Obligation:</strong> At the expiration of 14 days, your account will simply pause without any surprise charges unless you actively choose to purchase an ongoing commercial subscription.</li>
            </ul>

            <h2>3. Subscription Cancellation Procedure</h2>
            <p>
              Subscribers may cancel their subscription at any time without punitive exit fees, penalties, or lengthy justification. We provide a completely
              transparent self-serve cancellation workflow directly within your portal:
            </p>
            <h3>Self-Serve Cancellation Steps:</h3>
            <ol>
              <li>Log in to your <strong>Superadmin Portal</strong> at <Link href="https://app.zolofunds.com" style={{ color: 'var(--mk-primary)' }}>https://app.zolofunds.com</Link> using your administrative credentials.</li>
              <li>Navigate to <strong>Settings → Billing &amp; Subscriptions</strong> in the primary navigation menu.</li>
              <li>Under the active subscription summary, click on <strong>&quot;Manage Subscription&quot;</strong> and select <strong>&quot;Cancel Auto-Renewal&quot;</strong>.</li>
              <li>Confirm your decision. The portal will generate a timestamped <em>Cancellation Confirmation Receipt</em> and dispatch an automated confirmation email to your registered administrative email address.</li>
            </ol>
            <p>
              <strong>Effective Cancellation Date:</strong> Once cancelled, your recurring billing mandate with Razorpay is immediately revoked.
              Your software access remains fully operational until the final calendar day of your currently paid billing term (&quot;Expiration Date&quot;).
              No subsequent charges will ever be debited following cancellation confirmation.
            </p>

            <h2>4. Refund Eligibility & Rules</h2>
            <p>
              Because Zolo Funds provides digital software access that is immediately provisioned and utilized upon payment, monthly subscription fees
              are generally non-refundable once the billing period has commenced. However, full or partial refunds are granted under the following clear conditions:
            </p>

            <table className="mk-legal-table">
              <thead>
                <tr>
                  <th>Scenario / Trigger</th>
                  <th>Refund Quantum</th>
                  <th>Conditions &amp; Requirements</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Duplicate Billing / Gateway Error</strong></td>
                  <td><strong>100% Full Refund</strong></td>
                  <td>
                    If an automated recurring charge is processed more than once in the same billing cycle due to network timeouts, banking glitches, or Razorpay duplicate webhooks, the excess transaction is refunded immediately upon detection or within 24 hours of notification.
                  </td>
                </tr>
                <tr>
                  <td><strong>Billing Post-Cancellation</strong></td>
                  <td><strong>100% Full Refund</strong></td>
                  <td>
                    If your bank account or card is debited after an official in-app cancellation timestamp was generated, the full debited amount will be reversed immediately.
                  </td>
                </tr>
                <tr>
                  <td><strong>Annual Plan Cancellation (First 30 Days)</strong></td>
                  <td><strong>Pro-Rata Refund</strong></td>
                  <td>
                    If you subscribed to an annual prepayment plan and decide to cancel within the first <strong>thirty (30) calendar days</strong> of payment, we will refund the remaining 11 months of unused service. The first month of usage is retained at the non-discounted monthly plan rate.
                  </td>
                </tr>
                <tr>
                  <td><strong>Prolonged Unscheduled Platform Outage</strong></td>
                  <td><strong>Pro-Rata Service Credit or Refund</strong></td>
                  <td>
                    If Zolo Funds experiences unscheduled downtime resulting in monthly cloud availability falling below <strong>98.0%</strong> (excluding scheduled Sunday maintenance windows), subscribers are entitled to a pro-rated credit or refund for that calendar month upon written claim.
                  </td>
                </tr>
              </tbody>
            </table>

            <h2>5. Non-Refundable Items & Services</h2>
            <p>Refunds shall NOT be issued under the following circumstances:</p>
            <ul>
              <li><strong>Monthly Subscriptions Mid-Cycle:</strong> Cancellation of a monthly subscription after the billing cycle has begun does not entitle the subscriber to a pro-rated refund for the remaining days of that active month.</li>
              <li><strong>Annual Subscriptions Beyond 30 Days:</strong> Annual prepayment plans cancelled after the initial 30-day window are non-refundable. Your organization retains full access until the end of the 12-month paid term, after which auto-renewal ceases.</li>
              <li><strong>Custom Engineering &amp; Data Migration:</strong> Fees paid for bespoke software customisation, custom reporting template design, historical ledger data migration from legacy software, or dedicated on-site staff training workshops are strictly non-refundable once delivered.</li>
              <li><strong>Third-Party Pass-Through Expenses:</strong> Wallet credits purchased for transactional SMS (DLT routes), WhatsApp Business API notifications, or third-party credit bureau pull fees are consumed on an actual-cost basis and are strictly non-refundable.</li>
              <li><strong>Account Suspension for Policy Violations:</strong> Accounts terminated or suspended due to violations of our Terms of Service (e.g. fraudulent lending, usurious rates exceeding statutory caps, harassment of borrowers, or code tampering) forfeit all remaining subscription balances.</li>
            </ul>

            <h2>6. Refund Processing Timelines & Mechanism</h2>
            <p>
              All approved refunds are initiated through our authorized payment partner, <strong>Razorpay Software Private Limited</strong>,
              and returned exclusively to the original payment instrument used for the transaction:
            </p>
            <ul>
              <li><strong>Initiation Window:</strong> Once approved by our compliance and finance desk, refund instructions are submitted to the banking gateway within <strong>24 to 48 business hours</strong>.</li>
              <li><strong>Unified Payments Interface (UPI):</strong> Funds typically reflect in your linked bank account within <strong>2 to 24 hours</strong> of gateway release.</li>
              <li><strong>Net Banking (NEFT / IMPS / RTGS):</strong> Credited to your bank account within <strong>2 to 4 business days</strong> depending on your bank&apos;s settlement schedule.</li>
              <li><strong>Credit / Debit Cards:</strong> Reflected on your bank card statement within <strong>5 to 7 business days</strong> subject to your issuing bank&apos;s billing cycle.</li>
            </ul>

            <h2>7. Statutory GST Invoicing & Credit Notes</h2>
            <p>
              In strict adherence to the <strong>Central Goods and Services Tax Act, 2017 (CGST Act)</strong> and respective State GST enactments:
            </p>
            <ul>
              <li>All subscription charges include GST at the statutory rate of 18%, documented on official B2B Tax Invoices featuring our GSTIN and your organization&apos;s registered GSTIN (where provided).</li>
              <li>In the event of an approved refund, Zolo Funds will issue an official <strong>GST Credit Note under Section 34 of the CGST Act</strong> matching the exact refund quantum.</li>
              <li>The Credit Note will be uploaded to the GST portal and emailed to your billing contact so your accounting department can adjust your Input Tax Credit (ITC) accordingly.</li>
            </ul>

            <h2>8. Chargebacks & Payment Dispute Prevention</h2>
            <p>
              We strongly encourage subscribers to contact our dedicated billing desk prior to initiating a bank chargeback or payment reversal claim:
            </p>
            <ul>
              <li>Bank chargebacks often result in automated temporary freezing of merchant payment accounts and may cause automated suspension of your multi-tenant portal and field collection apps while under review.</li>
              <li>Our billing support team resolves 99% of billing discrepancies, erroneous renewals, and duplicate debits within <strong>one (1) business day</strong>, far faster than typical 30-to-60-day bank chargeback review cycles.</li>
            </ul>

            <h2>9. Data Export & Account Retention Post-Cancellation</h2>
            <p>
              We firmly respect your ownership of all financial records, borrower histories, and ledger books:
            </p>
            <ul>
              <li><strong>30-Day Grace Data Export Window:</strong> Following subscription expiration or cancellation, your Superadmin Portal provides a thirty (30) calendar day read-only grace period during which you can download complete database backups, day-books, loan registers, and customer KYC files in CSV, Excel, and PDF formats.</li>
              <li><strong>Decommissioning & Sanitization:</strong> Following the 30-day export window, tenant database records are de-provisioned in accordance with our <Link href="/security" style={{ color: 'var(--mk-primary)' }}>Security Architecture</Link> and statutory archival mandates.</li>
            </ul>

            <h2>10. Billing Grievances & Contact Information</h2>
            <p>
              For all billing inquiries, cancellation requests, refund claims, or tax invoice questions, please contact our dedicated accounts team:
            </p>
            <div className="mk-legal-callout">
              <b>Billing &amp; Accounts Desk:</b> Zolo Funds (India) Technologies Private Limited<br />
              <b>Corporate Office:</b> Anna Salai, Chennai, Tamil Nadu 600002, India<br />
              <b>Dedicated Billing Email:</b> <a href="mailto:billing@zolofunds.com" style={{ color: 'var(--mk-primary)', fontWeight: 700 }}>billing@zolofunds.com</a><br />
              <b>General Support:</b> <a href="mailto:support@zolofunds.com" style={{ color: 'var(--mk-primary)', fontWeight: 700 }}>support@zolofunds.com</a><br />
              <b>Accounts Helpline:</b> +91 98400 12345 (Mon–Sat, 09:30 AM to 06:30 PM IST)<br />
              <b>Response SLA:</b> Acknowledgment within 12 hours; resolution within 2 business days.
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
