import Link from 'next/link';
import { buildMetadata } from '../_components/seo';
import { BreadcrumbJsonLd } from '../_components/JsonLd';

export const metadata = buildMetadata({
  title: 'Cancellation & Refund Policy | Zolo Funds',
  description:
    'Official Cancellation, Subscription Termination, and Refund Policy for Zolo Funds SaaS subscriptions and modules. Compliant with Razorpay standards.',
  path: '/refund',
  keywords: [
    'Zolo Funds refund policy',
    'subscription cancellation',
    'Razorpay refund policy',
    'loan software subscription refund',
  ],
});

export default function RefundPolicyPage() {
  const lastUpdated = 'October 10, 2026';

  return (
    <>
      <BreadcrumbJsonLd name="Refund Policy" path="/refund" />

      <section className="mk-pagehero">
        <div className="mk-container">
          <span className="mk-eyebrow">Billing & Payments</span>
          <h1 className="mk-h1">Cancellation & Refund Policy</h1>
          <p className="mk-lead">
            Clear guidelines on subscription cancellations, billing dispute resolutions,
            and refund procedures for the Zolo Funds software platform.
          </p>
        </div>
      </section>

      <section className="mk-section mk-section--soft">
        <div className="mk-container">
          <article className="mk-legal">
            <div className="mk-legal-badge">Razorpay & Payment Gateway Compliant</div>

            <div className="mk-legal-meta">
              <div><b>Entity:</b> Zolo Funds (India) Technologies Private Limited</div>
              <div><b>Effective Date:</b> January 1, 2026</div>
              <div><b>Last Updated:</b> {lastUpdated}</div>
              <div><b>Payment Gateway Partner:</b> Razorpay Software Private Limited</div>
            </div>

            <h2>1. Free Trial Period</h2>
            <p>
              We believe in complete transparency. Every new organization registering on Zolo Funds receives an initial
              <strong> 14-Day Full-Feature Free Trial</strong>. During this trial period:
            </p>
            <ul>
              <li>No payment card or bank account commitment is required.</li>
              <li>You have full access to explore the loan management workflows, GPS field collection apps, and accounting reports.</li>
              <li>You may evaluate whether the platform fits your operational needs before making any financial payment.</li>
            </ul>

            <h2>2. Subscription Cancellation Procedure</h2>
            <p>
              You can cancel your recurring software subscription at any time without having to call or request permission:
            </p>
            <ol>
              <li>Log in to your <strong>Superadmin Portal</strong> at <Link href="https://app.zolofunds.com" style={{ color: 'var(--mk-primary)' }}>https://app.zolofunds.com</Link>.</li>
              <li>Navigate to <strong>Settings → Billing & Subscriptions</strong>.</li>
              <li>Click <strong>&quot;Cancel Subscription&quot;</strong> and confirm your selection.</li>
            </ol>
            <p>
              Upon cancellation, your subscription remains active until the end of your currently paid billing cycle. You will
              <strong> not</strong> be charged for subsequent billing periods.
            </p>

            <h2>3. Refund Eligibility & Rules</h2>
            <p>
              Since Zolo Funds is a digital software service with a full 14-day free trial, monthly and annual subscription fees are
              generally non-refundable once billed. However, refunds are granted under the following circumstances:
            </p>
            <ul>
              <li>
                <strong>Duplicate Charges:</strong> If an automated billing glitch or bank network duplicate charge results in your account being debited more than once for the same billing cycle, the duplicate amount will be <strong>refunded in full (100%)</strong>.
              </li>
              <li>
                <strong>Post-Cancellation Billing:</strong> If your card or account is debited after you received an official in-app cancellation confirmation timestamp, the full debited amount will be refunded immediately.
              </li>
              <li>
                <strong>Annual Plan Early Cancellation:</strong> For annual prepayment plans cancelled within the first <strong>30 calendar days</strong> of payment, a prorated refund will be provided for the remaining unused 11 months, deducting the standard single-month rate.
              </li>
            </ul>

            <h2>4. Non-Refundable Items</h2>
            <p>The following charges are non-refundable:</p>
            <ul>
              <li>Monthly subscription charges that have already commenced and where the service was accessible.</li>
              <li>Custom development fees, customized report templates, or dedicated on-site training sessions delivered by our specialists.</li>
              <li>Third-party pass-through costs (such as SMS/WhatsApp gateway credit top-ups or credit bureau pull charges).</li>
            </ul>

            <h2>5. Refund Processing Timelines</h2>
            <p>
              Approved refund requests are initiated within <strong>24 to 48 hours</strong> of verification. Depending on your bank
              or card issuer, the credited funds will reflect in your account within:
            </p>
            <ul>
              <li><strong>UPI / Net Banking:</strong> 2 to 4 business days.</li>
              <li><strong>Credit / Debit Cards:</strong> 5 to 7 business days.</li>
            </ul>
            <p>
              Refunds are processed strictly back to the <strong>original payment method</strong> used during checkout in compliance
              with RBI payment settlement directives.
            </p>

            <h2>6. How to Request a Refund</h2>
            <p>
              To request a refund or report a billing dispute, email our finance and billing desk with your registered email,
              business name, and Razorpay payment ID:
            </p>
            <div className="mk-legal-callout">
              <b>Billing & Accounts Desk:</b> Zolo Funds Technologies<br />
              <b>Email:</b> <a href="mailto:support@zolofunds.com" style={{ color: 'var(--mk-primary)' }}>support@zolofunds.com</a> / <a href="mailto:billing@zolofunds.com" style={{ color: 'var(--mk-primary)' }}>billing@zolofunds.com</a><br />
              <b>Phone:</b> +91 98400 12345 (Mon–Sat, 10:00 AM to 06:00 PM IST)
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
