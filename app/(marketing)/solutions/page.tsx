import CtaBand from '../_components/CtaBand';
import {
  CheckCircle, Coins, Shield, Users, Gem, Car, Building, Target, Zap,
} from '../_components/icons';

import { buildMetadata } from '../_components/seo';
import { BreadcrumbJsonLd } from '../_components/JsonLd';

export const metadata = buildMetadata({
  title: 'NBFC, Microfinance & Daily Collection Software Solutions',
  description:
    'LoanTrack solutions for NBFCs, micro-lenders, chit-fund companies and gold financiers — RBI-aligned loan management with daily field collection, multi-branch operations and GPS tracking.',
  path: '/solutions',
  keywords: ['NBFC software', 'microfinance software India', 'daily collection software', 'loan collection software'],
});

const SOLUTIONS = [
  {
    ic: Coins, v: 'mk-ic--amber', t: 'Micro-Lenders & Individual Financiers',
    d: 'Move off paper ledgers and spreadsheet apps. Get GPS-verified collection, automatic schedules and real books — without enterprise complexity or cost.',
    points: ['Daily/weekly/monthly collection lines', 'Agent float and cash-pool reconciliation', 'Affordable plans that scale with you'],
  },
  {
    ic: Shield, v: 'mk-ic--red', t: 'NBFCs', rev: true,
    d: 'RBI-aligned workflows with NPA auto-classification, provisioning and credit-bureau integration — built for regulated lending at scale.',
    points: ['NPA classification & provisioning', 'CIBIL / CRIF credit pulls', 'Multi-branch operations with role controls'],
  },
  {
    ic: Users, v: 'mk-ic--green', t: 'Chit-Fund Companies',
    d: 'Run groups, auctions and dividends with full member tracking and reconciliation — purpose-built, not bolted on.',
    points: ['Group & member lifecycle management', 'Auction winner recording', 'Per-cycle dividend distribution'],
  },
  {
    ic: Gem, v: 'mk-ic--purple', t: 'Gold & Auto Financiers', rev: true,
    d: 'Collateral-first lending with valuation, custody/registry tracking, redemption and repossession workflows in one system.',
    points: ['Collateral registry with photos', 'Valuation and LTV tracking', 'Auction & repossession workflows'],
  },
];

const WHY = [
  { ic: Target, t: 'Purpose-built for India', d: 'Aadhaar, UPI/Razorpay, chit funds, RBI norms and six languages — designed for how lending actually works here.' },
  { ic: Zap, t: 'Live in days, not months', d: 'Cloud-first with a free tier and guided onboarding — start small and switch on modules as you grow.' },
  { ic: Building, t: 'Multi-branch ready', d: 'Branch-level modules, agents and approvals with a superadmin view across your whole operation.' },
];

export default function SolutionsPage() {
  return (
    <>
      <BreadcrumbJsonLd name="Solutions" path="/solutions" />
      <section className="mk-pagehero">
        <div className="mk-container">
          <span className="mk-eyebrow">Solutions</span>
          <h1 className="mk-h1">Made for the way you lend</h1>
          <p className="mk-lead">
            Whether you run a single collection line or a multi-branch NBFC, LoanTrack
            adapts to your products, your team and your compliance needs.
          </p>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container">
          {SOLUTIONS.map((s) => (
            <div className={`mk-feature-row${s.rev ? ' mk-feature-row--rev' : ''}`} key={s.t}>
              <div>
                <span className="mk-eyebrow">For</span>
                <h2 className="mk-h2">{s.t}</h2>
                <p className="mk-lead">{s.d}</p>
                <ul className="mk-checklist">
                  {s.points.map((p) => (
                    <li key={p}><CheckCircle /> {p}</li>
                  ))}
                </ul>
              </div>
              <div className="mk-feature-row__media">
                <div className="mk-card">
                  <div className={`mk-card__ic ${s.v}`}><s.ic /></div>
                  <h3 className="mk-h3">{s.t}</h3>
                  <p>One platform, configured to your lending model.</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-section mk-section--dark">
        <div className="mk-container">
          <div className="mk-section-head">
            <span className="mk-eyebrow">Why LoanTrack</span>
            <h2 className="mk-h2">A modern alternative to legacy tools</h2>
          </div>
          <div className="mk-grid mk-grid--3">
            {WHY.map((w) => (
              <div className="mk-card" key={w.t}>
                <div className="mk-card__ic mk-ic--amber"><w.ic /></div>
                <h3 className="mk-h3">{w.t}</h3>
                <p>{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand title="Find the right fit for your business" text="Tell us how you lend and we'll show you exactly how LoanTrack maps to your operation." />
    </>
  );
}
