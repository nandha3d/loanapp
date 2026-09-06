import CtaBand from '../_components/CtaBand';
import {
  CheckCircle, Coins, Car, Gem, Users, MapPin, Wallet, Shield,
  Book, Chart, Bell, Doc, Smartphone, Globe,
} from '../_components/icons';

import { buildMetadata } from '../_components/seo';
import { BreadcrumbJsonLd } from '../_components/JsonLd';

export const metadata = buildMetadata({
  title: 'Micro Lending, Gold Loan, Chit Fund & Auto Finance Software',
  description:
    'Explore the ZoloFund platform — micro lending, auto finance, gold loan and chit fund software, plus GPS collection, agent wallets, eKYC, double-entry accounting and a native mobile app.',
  path: '/products',
  keywords: ['micro lending software', 'gold loan software', 'chit fund software', 'auto finance software', 'vehicle loan software'],
});

const MODULE_ROWS = [
  {
    ic: Coins, v: 'mk-ic--amber', t: 'Micro Lending',
    d: 'The core of ZoloFund — small-ticket personal loans on daily, weekly or monthly cycles with intelligent instalment scheduling.',
    points: ['Smart payment allocation (penalty → interest → principal)', 'Foreclosure & early-settlement calculator', 'Guarantor and security-cheque management', 'Configurable penalty and grace rules'],
  },
  {
    ic: Car, v: 'mk-ic--blue', t: 'Auto Finance', rev: true,
    d: 'Vehicle-backed lending with a complete collateral lifecycle, from registration to repossession.',
    points: ['Vehicle registry with condition photos', 'Collateral valuation and LTV tracking', 'Repossession flags and status workflow', 'Insurance and document expiry alerts'],
  },
  {
    ic: Gem, v: 'mk-ic--purple', t: 'Gold Loan',
    d: 'Gold-collateral lending with valuation, secure custody tracking and redemption management.',
    points: ['Ornament-wise valuation and purity capture', 'Redemption and renewal tracking', 'Auction management for defaults', 'Interest-slab configuration'],
  },
  {
    ic: Users, v: 'mk-ic--green', t: 'Chit Funds', rev: true,
    d: 'End-to-end chit group management — from member enrolment to auctions and dividends.',
    points: ['Group creation and member tracking', 'Auction winner recording', 'Dividend distribution per member', 'Per-cycle payment reconciliation'],
  },
];

const PLATFORM = [
  { ic: MapPin, v: 'mk-ic--amber', t: 'GPS Collection', d: 'Geo-stamped collections, live agent tracking and route check-ins with photo proof.' },
  { ic: Wallet, v: 'mk-ic--green', t: 'Wallet Module', d: 'Agent float, branch cash pools, handovers and a reconciliation ledger.' },
  { ic: Shield, v: 'mk-ic--red', t: 'KYC & Bureau', d: 'Aadhaar eKYC, Video KYC and direct CIBIL/CRIF credit-score pulls.' },
  { ic: Book, v: 'mk-ic--purple', t: 'Premium Accounting', d: 'Double-entry GL, journals, bank reconciliation, P&L and period locks.' },
  { ic: Chart, v: 'mk-ic--blue', t: 'Analytics', d: 'Portfolio trends, collection efficiency and agent performance dashboards.' },
  { ic: Bell, v: 'mk-ic--amber', t: 'Notifications', d: 'SMS & WhatsApp templates with an automated dunning engine.' },
  { ic: Doc, v: 'mk-ic--green', t: 'Reports & PDF', d: 'Loan statements, receipts, defaulter lists and daily summaries — one-click export.' },
  { ic: Smartphone, v: 'mk-ic--blue', t: 'Mobile App', d: 'Native Android & iOS app with offline collection and biometric login.' },
];

export default function ProductsPage() {
  return (
    <>
      <BreadcrumbJsonLd name="Products" path="/products" />
      <section className="mk-pagehero">
        <div className="mk-container">
          <span className="mk-eyebrow">The Platform</span>
          <h1 className="mk-h1">One platform, every lending product</h1>
          <p className="mk-lead">
            Four lending modules and a full operations toolkit — collection, wallets,
            KYC, accounting and analytics — working together out of the box.
          </p>
        </div>
      </section>

      {/* Module deep-dives */}
      <section className="mk-section">
        <div className="mk-container">
          {MODULE_ROWS.map((m) => (
            <div className={`mk-feature-row${m.rev ? ' mk-feature-row--rev' : ''}`} key={m.t}>
              <div>
                <span className="mk-eyebrow">Lending Module</span>
                <h2 className="mk-h2">{m.t}</h2>
                <p className="mk-lead">{m.d}</p>
                <ul className="mk-checklist">
                  {m.points.map((p) => (
                    <li key={p}><CheckCircle /> {p}</li>
                  ))}
                </ul>
              </div>
              <div className="mk-feature-row__media">
                <div className="mk-card">
                  <div className={`mk-card__ic ${m.v}`}><m.ic /></div>
                  <h3 className="mk-h3">{m.t}</h3>
                  <p>Fully integrated with collection, wallets and accounting — enable it per branch.</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Platform capabilities */}
      <section className="mk-section mk-section--soft">
        <div className="mk-container">
          <div className="mk-section-head">
            <span className="mk-eyebrow">Platform capabilities</span>
            <h2 className="mk-h2">Everything around the loan</h2>
            <p className="mk-lead">The operational backbone that turns lending products into a running business.</p>
          </div>
          <div className="mk-grid mk-grid--4">
            {PLATFORM.map((f) => (
              <div className="mk-card" key={f.t}>
                <div className={`mk-card__ic ${f.v}`}><f.ic /></div>
                <h3 className="mk-h3" style={{ fontSize: '1.1rem' }}>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Languages */}
      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-split">
            <div>
              <span className="mk-eyebrow">Built for India</span>
              <h2 className="mk-h2">Six languages, one platform</h2>
              <p className="mk-lead">
                Every label, report and notification is fully localised — so your agents and
                customers work in the language they&apos;re most comfortable with.
              </p>
            </div>
            <div className="mk-grid mk-grid--3" style={{ gap: 14 }}>
              {['English', 'हिन्दी', 'தமிழ்', 'తెలుగు', 'ಕನ್ನಡ', 'മലയാളം'].map((l) => (
                <div className="mk-card" key={l} style={{ padding: '20px', textAlign: 'center' }}>
                  <div className="mk-card__ic mk-ic--amber" style={{ margin: '0 auto 12px' }}><Globe /></div>
                  <b style={{ fontSize: '1.05rem' }}>{l}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CtaBand title="See the platform in action" text="Book a guided walkthrough and we'll tailor it to the products you offer." />
    </>
  );
}
