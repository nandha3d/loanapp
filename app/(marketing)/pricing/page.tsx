import Link from 'next/link';
import CtaBand from '../_components/CtaBand';
import { Check, Arrow } from '../_components/icons';

import { buildMetadata } from '../_components/seo';
import { FaqJsonLd, BreadcrumbJsonLd } from '../_components/JsonLd';

export const metadata = buildMetadata({
  title: 'Pricing — Loan Management Software Plans from ₹0',
  description:
    'Simple, transparent pricing for LoanTrack loan management software. Start free, then scale to Basic, Business or Enterprise. No setup fees, no lock-in.',
  path: '/pricing',
  keywords: ['loan management software pricing', 'affordable loan software', 'microfinance software price', 'loan software cost India'],
});

const PLANS = [
  {
    name: 'Free', price: '₹0', period: 'forever',
    desc: 'For solo financiers getting started with digital collection.',
    feats: ['Up to 25 active loans', '1 agent · 1 branch', 'Micro-lending module', 'GPS collection & receipts', 'Basic reports'],
    cta: 'Start Free', feat: false,
  },
  {
    name: 'Basic', price: '₹999', period: '/mo + GST',
    desc: 'For growing lenders ready to add a second product line.',
    feats: ['Up to 200 active loans', '10 agents · 2 branches', 'Micro-lending + Auto Finance', 'GPS & agent wallets', 'Premium add-ons optional'],
    cta: 'Choose Basic', feat: false,
  },
  {
    name: 'Business', price: '₹2,999', period: '/mo + GST',
    desc: 'For multi-branch operations running all four modules.',
    feats: ['Up to 1,000 active loans', '50 agents · 5 branches', 'All four lending modules', 'Premium accounting & KYC', 'WhatsApp & SMS notifications'],
    cta: 'Choose Business', feat: true,
  },
  {
    name: 'Enterprise', price: '₹7,999', period: '/mo + GST',
    desc: 'For NBFCs needing scale, compliance and full add-ons.',
    feats: ['Unlimited loans', 'Unlimited agents & branches', 'All modules + premium included', 'Credit bureau & NPA engine', '15-day full-feature trial'],
    cta: 'Talk to Sales', feat: false,
  },
];

const FAQ = [
  { q: 'Is there a free plan?', a: 'Yes — the Free plan supports up to 25 active loans forever, with no card required. Upgrade only when you grow.' },
  { q: 'What are premium add-ons?', a: 'Optional modules like double-entry accounting, Aadhaar eKYC, credit-bureau pulls, GPS tracking and the foreclosure calculator. They are included on Enterprise.' },
  { q: 'Do prices include GST?', a: 'Paid plans are billed in INR plus 18% GST. Billing is monthly via Razorpay with a plan-dependent grace period.' },
  { q: 'Can I switch modules later?', a: 'Absolutely. Enable or disable lending modules per branch at any time as your business changes.' },
];

export default function PricingPage() {
  return (
    <>
      <FaqJsonLd items={FAQ} />
      <BreadcrumbJsonLd name="Pricing" path="/pricing" />
      <section className="mk-pagehero">
        <div className="mk-container">
          <span className="mk-eyebrow">Pricing</span>
          <h1 className="mk-h1">Pricing that grows with you</h1>
          <p className="mk-lead">
            Start free and upgrade only when you need to. No setup fees, no lock-in —
            just transparent monthly plans.
          </p>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-price-grid">
            {PLANS.map((p) => (
              <div className={`mk-price${p.feat ? ' mk-price--feat' : ''}`} key={p.name}>
                <h3 className="mk-h3">{p.name}</h3>
                <div className="mk-price__amt"><b>{p.price}</b><span>{p.period}</span></div>
                <p className="mk-price__desc">{p.desc}</p>
                <ul className="mk-price__feats">
                  {p.feats.map((f) => (
                    <li key={f}><Check /> {f}</li>
                  ))}
                </ul>
                <Link
                  href="/contact"
                  className={`mk-btn ${p.feat ? 'mk-btn--primary' : 'mk-btn--ghost'}`}
                  style={{ width: '100%' }}
                >
                  {p.cta} <Arrow />
                </Link>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: 'var(--mk-text-light)', fontSize: '0.85rem', marginTop: 24 }}>
            All paid plans billed in INR + 18% GST. Cancel anytime.
          </p>
        </div>
      </section>

      <section className="mk-section mk-section--soft">
        <div className="mk-container">
          <div className="mk-section-head">
            <span className="mk-eyebrow">FAQ</span>
            <h2 className="mk-h2">Questions, answered</h2>
          </div>
          <div className="mk-grid mk-grid--2" style={{ maxWidth: 920, margin: '0 auto' }}>
            {FAQ.map((f) => (
              <div className="mk-card" key={f.q}>
                <h3 className="mk-h3" style={{ fontSize: '1.05rem' }}>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand title="Not sure which plan fits?" text="Tell us about your portfolio and we'll recommend the right plan — and set you up free." />
    </>
  );
}
