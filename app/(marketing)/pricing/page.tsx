import Link from 'next/link';
import CtaBand from '../_components/CtaBand';
import { Check, Arrow } from '../_components/icons';

import { buildMetadata } from '../_components/seo';
import { FaqJsonLd, BreadcrumbJsonLd } from '../_components/JsonLd';
import { getPublicPricing, type PublicPlan } from '@/lib/planCatalog';

// Pricing is read from the catalog at request time — never hardcoded here.
export const dynamic = 'force-dynamic';

export const metadata = buildMetadata({
  title: 'Pricing — Loan Management Software Plans from ₹0',
  description:
    'Simple, transparent pricing for ZoloFund loan management software. Start free, then scale to Collector, Basic, Business or Enterprise. No setup fees, no lock-in.',
  path: '/pricing',
  keywords: ['loan management software pricing', 'affordable loan software', 'microfinance software price', 'loan software cost India'],
});

// Plan featured on the grid (visual emphasis only). Configurable, not a price.
const FEATURED_PLAN = 'business';

/** Map a catalog row to the pricing-card view model. No prices live here. */
function toCard(p: PublicPlan) {
  const isFree = p.monthlyPrice === 0;
  const isEnterprise = p.plan === 'enterprise';
  const priceLabel = isFree ? '₹0' : `₹${p.monthlyPrice.toLocaleString('en-IN')}`;
  const period = isFree ? 'forever' : '/mo + GST';
  const cta = p.plan === 'free' ? 'Start Free' : isEnterprise ? 'Talk to Sales' : `Choose ${p.displayName}`;
  return {
    name: p.displayName,
    price: priceLabel,
    period,
    desc: p.description ?? '',
    feats: p.features,
    cta,
    feat: p.plan === FEATURED_PLAN,
  };
}

const FAQ = [
  { q: 'Is there a free plan?', a: 'Yes — the Free plan is free forever, with no card required. Upgrade only when you grow.' },
  { q: 'What are premium add-ons?', a: 'Optional modules like double-entry accounting, Aadhaar eKYC, credit-bureau pulls, GPS tracking and the foreclosure calculator. They are included on Enterprise.' },
  { q: 'Do prices include GST?', a: 'Paid plans are billed in INR plus 18% GST. Billing is monthly via Razorpay with a plan-dependent grace period.' },
  { q: 'Can I switch modules later?', a: 'Absolutely. Enable or disable lending modules per branch at any time as your business changes.' },
];

export default async function PricingPage() {
  const { plans } = await getPublicPricing();
  const cards = plans.map(toCard);

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
            {cards.map((p) => (
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
