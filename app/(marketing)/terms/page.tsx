import Link from 'next/link';
import { buildMetadata } from '../_components/seo';
import { BreadcrumbJsonLd } from '../_components/JsonLd';

export const metadata = buildMetadata({
  title: 'Terms of Service | Zolo Funds — Master SaaS Agreement & Commercial Terms',
  description:
    'Exhaustive Terms of Service and Master SaaS Agreement governing the use of the Zolo Funds lending management platform, APIs, multi-tenant portal, and mobile apps. Governed by Indian Law and RBI guidelines.',
  path: '/terms',
  keywords: [
    'Zolo Funds terms of service',
    'lending software agreement India',
    'fintech SaaS terms',
    'microfinance software contract',
    'master subscription agreement',
    'RBI digital lending software compliance',
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
            <div className="mk-legal-badge">Master Subscription Agreement (Republic of India)</div>

            <div className="mk-legal-meta">
              <div><b>Licensor:</b> Zolo Funds (India) Technologies Private Limited</div>
              <div><b>CIN:</b> U72900TN2026PTC158920</div>
              <div><b>Governing Law:</b> Laws of the Republic of India</div>
              <div><b>Exclusive Jurisdiction:</b> Courts of Chennai, Tamil Nadu</div>
              <div><b>Effective Date:</b> January 1, 2026</div>
              <div><b>Last Updated:</b> {lastUpdated}</div>
            </div>

            <div className="mk-legal-callout mk-legal-callout--alert">
              <strong>CRITICAL REGULATORY NOTICE — NON-LENDER STATUS & COMPLIANCE DIVISION:</strong>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                Zolo Funds (India) Technologies Private Limited is exclusively a technology and software development company (Technology Service Provider / Lending SaaS).
                <strong> Zolo Funds IS NOT A LENDER, BANK, NON-BANKING FINANCIAL COMPANY (NBFC), HOUSING FINANCE COMPANY, OR COOPERATIVE SOCIETY.</strong>
                We do not solicit, evaluate, approve, fund, guarantee, or collect loans for our own account. The subscribing customer
                (&quot;Tenant&quot;, &quot;Subscriber&quot;, or &quot;Customer&quot;) acknowledges that it holds sole legal responsibility for obtaining
                and maintaining all statutory money lending licenses, NBFC certificates from the Reserve Bank of India, state registrations under
                the Chit Funds Act 1982, or relevant cooperative society registrations. The Tenant warrants full compliance with all statutory lending
                ceilings, fair practices, and ethical recovery mandates.
              </p>
            </div>

            <h2>Article 1: Preamble, Acceptance of Terms & Corporate Representations</h2>
            <p>
              This Master Software-as-a-Service Agreement (&quot;Agreement&quot; or &quot;Terms&quot;) is a legally binding contract entered into between
              <strong> Zolo Funds (India) Technologies Private Limited</strong>, a company incorporated under the Companies Act, 2013 having its corporate office at Anna Salai, Chennai, Tamil Nadu 600002
              (&quot;Zolo Funds&quot;, &quot;Licensor&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) and the legal entity, sole proprietorship, partnership firm, company,
              or cooperative institution subscribing to, accessing, or utilizing the software services (&quot;Customer&quot;, &quot;Tenant&quot;, &quot;Subscriber&quot;, or &quot;you&quot;).
            </p>
            <p>
              By accessing our web portals (<Link href="https://zolofunds.com" style={{ color: 'var(--mk-primary)' }}>https://zolofunds.com</Link> and <Link href="https://app.zolofunds.com" style={{ color: 'var(--mk-primary)' }}>https://app.zolofunds.com</Link>),
              downloading or installing our Android mobile applications, integrating our cloud APIs, or executing a digital subscription payment via Razorpay,
              you acknowledge that you have read, understood, and agreed to be legally bound by this Agreement and our incorporated
              <Link href="/privacy" style={{ color: 'var(--mk-primary)', textDecoration: 'underline' }}> Privacy Policy</Link>,
              <Link href="/refund" style={{ color: 'var(--mk-primary)', textDecoration: 'underline' }}> Cancellation &amp; Refund Policy</Link>, and
              <Link href="/security" style={{ color: 'var(--mk-primary)', textDecoration: 'underline' }}> Security Architecture Overview</Link>.
            </p>
            <p>
              The individual executing or accepting this Agreement on behalf of the Tenant represents and warrants that they possess full legal authority,
              corporate board power, or power of attorney to bind the Tenant to all covenants, obligations, and liabilities contained herein.
            </p>

            <h2>Article 2: Statutory Non-Lender Status & Regulatory Allocation of Responsibility</h2>
            <ul>
              <li><strong>Pure Software Provision:</strong> The platform is designed solely to automate ledger record-keeping, schedule generation, field collection tracking, and customer communication. Zolo Funds does not underwrite loans, guarantee repayments, assess borrower creditworthiness, or intermediate capital flows.</li>
              <li><strong>Licensing Warranties:</strong> The Tenant covenants that it possesses and shall continuously maintain all statutory registrations required to conduct its lending, auto financing, gold loan, or chit fund operations under Indian law (including RBI NBFC registration, State Money Lenders Acts, Tamil Nadu Money Lenders Act, Chit Funds Act 1982, or applicable Cooperative Societies Acts).</li>
              <li><strong>Zero Intermediation in Customer Funds:</strong> All loan disbursements, installment collections, interest receipts, and auction payouts flow directly between the Tenant and its borrowers or chit subscribers through the Tenant&apos;s own bank accounts, cash drawers, or merchant payment gateways. Zolo Funds never touches, holds, escrows, or pools customer lending funds.</li>
            </ul>

            <h2>Article 3: Scope of SaaS License Grant & Software Modules</h2>
            <p>
              Subject to timely payment of subscription fees and compliance with this Agreement, Zolo Funds grants you a non-exclusive, non-transferable,
              non-sublicensable, revocable cloud license to access and operate the hosted multi-tenant software modules designated in your active subscription tier:
            </p>
            <ul>
              <li><strong>Micro Lending &amp; Daily Collection Module:</strong> Daily, weekly, bi-weekly, and monthly loan origination; flat and reducing balance EMI schedule computation; door-to-door field collection agent route management; GPS geo-stamped digital receipting; automated grace period tracking; and overdue penalty computation engines.</li>
              <li><strong>Auto Finance &amp; Hire Purchase Module:</strong> Hire Purchase (HP) agreement lifecycle; vehicle chassis and engine number tracking; hypothecation endorsement registers; guarantor and co-applicant management; insurance expiry alerts; and vehicle repossession notice workflows.</li>
              <li><strong>Gold Loan &amp; Jewel Mortgage Module:</strong> Gold ornament physical appraisal records; gross weight, net weight, stone deduction, and karat purity tracking; safe vault packet allocation; bullet repayment schedules; compounding interest accrual; and overdue loan auction statutory notice registers.</li>
              <li><strong>Chit Fund Operating Module:</strong> Chit group formation; foreman commission computation; monthly auction bidding logs; prize money distribution accounting; non-prized subscriber dividend allocation; and statutory registrar compliance filing reports under the Chit Funds Act, 1982.</li>
              <li><strong>Double-Entry Ledger &amp; Accounting Engine:</strong> Automated journal voucher generation, day-books, cash books, bank books, trial balances, profit &amp; loss statements, balance sheets, and cash float remittance verification workflows.</li>
            </ul>

            <h2>Article 4: Tenant Regulatory Covenants &amp; Fair Practices Code</h2>
            <p>The Tenant explicitly covenants and agrees that it shall at all times:</p>
            <ul>
              <li><strong>Adhere to Statutory Interest Caps &amp; APR Disclosures:</strong> Comply strictly with all applicable maximum interest rate ceilings prescribed by the Reserve Bank of India or relevant State Money Lending laws. The Tenant is solely responsible for inputting legal interest rates into the software.</li>
              <li><strong>Key Fact Statement (KFS) Mandate:</strong> In accordance with RBI Digital Lending Guidelines, the Tenant covenants to deliver transparent Key Fact Statements (KFS) detailing total cost of credit, processing fees, and annual percentage rates (APR) to borrowers prior to loan execution.</li>
              <li><strong>Ethical Field Recovery &amp; Debt Collection Norms:</strong> The Tenant covenants that its field recovery officers, branch managers, and collection staff shall strictly abide by the RBI Fair Practices Code. The Tenant specifically warrants that agents:
                <ul>
                  <li>Shall NOT contact borrowers before <strong>08:00 AM</strong> or after <strong>07:00 PM</strong>;</li>
                  <li>Shall NOT resort to intimidation, harassment, verbal abuse, public humiliation, or physical threats;</li>
                  <li>Shall NOT contact unrelated third parties, neighbors, or workplace associates to shame the borrower.</li>
                </ul>
                <strong>Zolo Funds explicitly disclaims any liability for tortious, civil, or criminal acts committed by Tenant personnel during field collections.</strong>
              </li>
              <li><strong>Borrower Consent under DPDP Act 2023:</strong> The Tenant acts as the Data Fiduciary for borrower records and warrants that it has secured valid, informed, verifiable consent from borrowers prior to entering their personal data, PAN, masked Aadhaar reference, or photographs into the software.</li>
            </ul>

            <h2>Article 5: User Account Hierarchy, Access Control &amp; Maker-Checker Controls</h2>
            <ul>
              <li><strong>Authorized Personnel Only:</strong> Login credentials (usernames, passwords, 2FA tokens) may only be assigned to bona fide employees, registered partners, and authorized field agents of the Tenant.</li>
              <li><strong>Role-Based Access Control (RBAC):</strong> The Tenant Superadmin is solely responsible for properly configuring role permissions (Superadmin, Branch Manager, Loan Officer, Cashier, Field Agent).</li>
              <li><strong>Maker-Checker Dual Authorization:</strong> High-risk operational actions—including loan sanctions exceeding pre-set branch limits, manual repayment waivers, interest rate overrides, penalty write-offs, and ledger reversals—must be configured and audited through the platform&apos;s dual authorization workflow.</li>
              <li><strong>Device &amp; Credential Confidentiality:</strong> The Tenant is strictly responsible for safeguarding all administrative credentials. Zolo Funds must be notified immediately in writing at <a href="mailto:security@zolofunds.com" style={{ color: 'var(--mk-primary)' }}>security@zolofunds.com</a> of any compromised staff mobile terminal, stolen credential, or unauthorized login.</li>
            </ul>

            <h2>Article 6: Subscription Fees, Invoicing &amp; Razorpay Billing</h2>
            <ul>
              <li><strong>Pricing Plans:</strong> Software license fees are billed on a recurring monthly or annual basis according to the tier selected (Starter, Growth, Scale, or Enterprise) as published on our Pricing Schedule.</li>
              <li><strong>Automated Payment Gateway:</strong> Recurring online subscription payments are processed securely through our authorized payment partner, <strong>Razorpay Software Private Limited</strong>. By registering an active payment method (card, net banking mandate, or UPI AutoPay), you authorize automated periodic debits for subscription renewals.</li>
              <li><strong>Goods and Services Tax (GST):</strong> All stated software fees are exclusive of Indian Goods and Services Tax (GST at 18%). Official GST Tax Invoices will be generated and made downloadable in your Superadmin Portal for Input Tax Credit (ITC) reconciliation.</li>
              <li><strong>Grace Period &amp; Suspension:</strong> In the event an automated recurring debit fails, a <strong>seven (7) calendar day grace period</strong> is provided. If payment is not cleared following automated electronic reminders, administrative portal access and mobile field agent sync will be paused until outstanding balances are cleared.</li>
            </ul>

            <h2>Article 7: Prohibited Uses &amp; Acceptable Use Policy</h2>
            <p>The Tenant, its employees, agents, and authorized users shall NOT under any circumstances:</p>
            <ul>
              <li>Reverse engineer, decompile, disassemble, or extract source code from the web portal, cloud APIs, or Android mobile APK;</li>
              <li>Attempt to circumvent multi-tenant database scoping, tamper with SQL queries, or access data belonging to other organizations;</li>
              <li>Utilize the software to facilitate usurious money lending exceeding statutory caps, money laundering, terror financing, or unlicensed chit fund schemes;</li>
              <li>Bypass branch seat caps, field agent limits, or borrower thresholds by manipulating API headers or authentication tokens;</li>
              <li>Sublicense, lease, white-label, or resell the platform as a third-party commercial bureau without an executed Enterprise Partner Agreement;</li>
              <li>Conduct automated vulnerability scanning, load testing, or penetration testing against production servers without prior written authorization from Zolo Funds.</li>
            </ul>

            <h2>Article 8: Intellectual Property &amp; Customer Data Ownership</h2>
            <ul>
              <li><strong>Customer Data Ownership:</strong> The Tenant retains sole, exclusive, and unencumbered ownership of all loan files, borrower KYC records, field collection entries, transaction logs, and financial day-books uploaded to or generated by the Tenant (&quot;Customer Data&quot;). Zolo Funds claims zero ownership in Customer Data.</li>
              <li><strong>Licensor Platform Intellectual Property:</strong> Zolo Funds retains sole and exclusive ownership of all software code, proprietary calculation algorithms, user interface designs, database schemas, documentation, trademarks, logos, and trade secrets related to the Zolo Funds platform.</li>
              <li><strong>Aggregated Benchmarking &amp; Telemetry:</strong> Zolo Funds may collect and process anonymized, aggregated technical performance metrics (e.g. system throughput, API latency, crash logs) that do not identify the Tenant or any individual borrower, solely to enhance platform performance and reliability.</li>
            </ul>

            <h2>Article 9: Service Level Agreement (SLA) &amp; Technical Support</h2>
            <ul>
              <li><strong>99.9% Uptime Commitment:</strong> Zolo Funds targets a <strong>99.9% monthly cloud availability</strong> for its production APIs and database infrastructure, measured on a 24x7 basis (excluding scheduled maintenance).</li>
              <li><strong>Scheduled Maintenance Windows:</strong> Essential database indexing, security patching, and server updates are scheduled during low-traffic windows (Sundays between 01:00 AM and 04:00 AM IST) with prior electronic notice posted on the portal dashboard.</li>
              <li><strong>Technical Support Desk:</strong> Multi-lingual technical assistance (English, Tamil, Hindi, Telugu, Kannada, Malayalam) is available Monday through Saturday, 09:00 AM to 07:00 PM IST via:
                <ul>
                  <li>Email: <a href="mailto:support@zolofunds.com" style={{ color: 'var(--mk-primary)' }}>support@zolofunds.com</a></li>
                  <li>Helpline: +91 98400 12345</li>
                  <li>In-Portal Help Desk Ticketing</li>
                </ul>
              </li>
            </ul>

            <h2>Article 10: Disclaimer of Warranties &amp; Zero Loan Loss Liability</h2>
            <ul>
              <li><strong>Software Provided &quot;AS IS&quot;:</strong> While Zolo Funds adheres to the highest engineering standards and verifies calculations against 185+ automated mathematical test suites, the software is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of merchantability or fitness for a particular commercial outcome.</li>
              <li><strong>Zero Liability for Lending Defaults:</strong> Zolo Funds is NOT liable for borrower non-payment, loan defaults, field agent embezzlement, collateral valuation depreciation, stolen gold ornaments, or non-performing asset (NPA) losses incurred by the Tenant.</li>
              <li><strong>No Tax or Legal Advisory:</strong> The software provides accounting tools but does not constitute formal legal, taxation, or financial advisory. The Tenant is advised to consult certified chartered accountants and legal practitioners for statutory compliance.</li>
            </ul>

            <h2>Article 11: Limitation of Liability &amp; Monetary Cap</h2>
            <ul>
              <li><strong>Waiver of Consequential Damages:</strong> In no event shall Zolo Funds, its directors, officers, software engineers, or affiliates be liable for indirect, incidental, special, punitive, or consequential damages, including loss of profits, loss of data, loss of goodwill, or business interruption.</li>
              <li><strong>Aggregate Monetary Cap:</strong> The total cumulative liability of Zolo Funds for any and all claims, disputes, or causes of action arising out of or related to this Agreement—whether in contract, tort, negligence, or strict liability—shall be strictly capped at the total software subscription fees actually paid by the Tenant to Zolo Funds in the <strong>three (3) months immediately preceding the event</strong> giving rise to liability.</li>
            </ul>

            <h2>Article 12: Mutual Indemnification</h2>
            <p>
              The Tenant agrees to defend, indemnify, and hold harmless Zolo Funds, its directors, officers, and developers from and against
              any third-party claims, legal proceedings, government fines, consumer court complaints, or damages arising out of:
            </p>
            <ul>
              <li>The Tenant&apos;s breach of applicable Reserve Bank of India directives, state money lending regulations, or consumer protection laws;</li>
              <li>Allegations of abusive, unlawful, or coercive debt collection practices committed by the Tenant&apos;s field collection officers or recovery agents;</li>
              <li>The Tenant&apos;s failure to secure valid DPDP Act borrower consent prior to uploading sensitive KYC records into the platform;</li>
              <li>Any dispute between the Tenant and its borrowers, guarantors, or chit fund subscribers regarding loan terms, interest rates, or prize distributions.</li>
            </ul>

            <h2>Article 13: Term, Auto-Renewal, Cancellation &amp; Exit Data Extraction</h2>
            <ul>
              <li><strong>Term &amp; Auto-Renewal:</strong> This Agreement begins on the date of account creation or license purchase and continues for the selected billing term (monthly or annual), automatically renewing unless cancelled.</li>
              <li><strong>Self-Serve Cancellation:</strong> The Tenant may cancel auto-renewal at any time via <strong>Settings → Billing</strong> in the Superadmin Portal. Cancellation takes effect at the end of the currently paid billing period.</li>
              <li><strong>Termination for Cause:</strong> Zolo Funds reserves the right to immediately terminate access if the Tenant engages in system tampering, illegal lending activities, or fails to cure subscription payment defaults after written notice.</li>
              <li><strong>30-Day Post-Termination Data Export Window:</strong> Upon subscription expiration or termination, Zolo Funds provides the Tenant with a <strong>thirty (30) calendar day read-only grace period</strong> to download complete database exports, day-books, loan registers, and customer KYC files in standard CSV, Excel, and JSON formats. Following the 30-day window, tenant database records are de-provisioned in compliance with statutory archival schedules.</li>
            </ul>

            <h2>Article 14: Confidentiality &amp; Trade Secrets</h2>
            <p>
              Each party agrees to maintain the strict confidentiality of the other party&apos;s proprietary information (&quot;Confidential Information&quot;).
              Confidential Information includes Customer Data, financial registers, software source code, algorithmic logic, pricing agreements, and security specifications.
              Neither party shall disclose Confidential Information to any third party without prior written consent, except to authorized employees, auditors,
              or as strictly mandated by valid court orders or statutory government authorities.
            </p>

            <h2>Article 15: Mandatory Dispute Resolution &amp; Binding Arbitration</h2>
            <p>
              Any dispute, controversy, or claim arising out of or relating to this Agreement, including its execution, breach, interpretation, termination, or validity,
              shall first be subjected to informal executive negotiation between designated senior executives of both parties for a period of thirty (30) calendar days.
            </p>
            <p>
              If unresolved through executive negotiation, the dispute shall be referred to and finally resolved by binding arbitration conducted under the
              <strong>Arbitration and Conciliation Act, 1996</strong> (including statutory amendments thereto):
            </p>
            <ul>
              <li>The arbitral tribunal shall consist of a <strong>sole arbitrator</strong> mutually appointed by the parties. If the parties fail to agree within 30 days, the arbitrator shall be appointed in accordance with the Act.</li>
              <li>The seat and legal venue of arbitration shall be <strong>Chennai, Tamil Nadu, India</strong>.</li>
              <li>The language of the arbitral proceedings shall be <strong>English</strong>.</li>
              <li>The arbitral award shall be final, conclusive, and binding upon both parties, enforceable in any court of competent jurisdiction.</li>
            </ul>

            <h2>Article 16: Governing Law, Jurisdiction &amp; Miscellaneous</h2>
            <ul>
              <li><strong>Governing Law:</strong> This Agreement shall be governed by, interpreted, and construed in accordance with the substantive laws of the Republic of India.</li>
              <li><strong>Exclusive Court Jurisdiction:</strong> Subject to the mandatory arbitration clause in Article 15, the competent courts located in <strong>Chennai, Tamil Nadu, India</strong> shall possess exclusive jurisdiction over any legal proceedings arising hereunder.</li>
              <li><strong>Severability:</strong> If any provision of this Agreement is held to be invalid or unenforceable, that provision shall be enforced to the maximum extent permissible, and the remaining provisions shall remain in full force and effect.</li>
              <li><strong>Force Majeure:</strong> Neither party shall be liable for delays or failures in performance resulting from acts of God, strikes, pandemics, government lockdowns, utility failures, or major telecommunication outages beyond reasonable control.</li>
              <li><strong>Entire Agreement:</strong> This Agreement, together with the incorporated Privacy Policy, Refund Policy, and Security Architecture, constitutes the entire agreement between the parties concerning the subject matter hereof and supersedes all prior proposals, marketing collateral, or informal understandings.</li>
            </ul>

            <div style={{ marginTop: 40 }}>
              <h2>Article 17: Official Legal Notices &amp; Communication</h2>
              <p>All formal legal notices, contractual amendments, or arbitration filings must be addressed to:</p>
              <div className="mk-legal-callout">
                <b>Legal &amp; Compliance Directorate:</b> Zolo Funds (India) Technologies Private Limited<br />
                <b>Corporate Office:</b> Anna Salai, Chennai, Tamil Nadu 600002, India<br />
                <b>CIN:</b> U72900TN2026PTC158920<br />
                <b>Official Legal Email:</b> <a href="mailto:legal@zolofunds.com" style={{ color: 'var(--mk-primary)', fontWeight: 700 }}>legal@zolofunds.com</a><br />
                <b>General Inquiries:</b> <a href="mailto:support@zolofunds.com" style={{ color: 'var(--mk-primary)', fontWeight: 700 }}>support@zolofunds.com</a><br />
                <b>Corporate Phone:</b> +91 98400 12345
              </div>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
