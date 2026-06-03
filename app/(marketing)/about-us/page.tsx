import CtaBand from '../_components/CtaBand';
import { Heart, Target, Shield, Zap, Users, Globe } from '../_components/icons';

import { buildMetadata } from '../_components/seo';
import { BreadcrumbJsonLd } from '../_components/JsonLd';

export const metadata = buildMetadata({
  title: 'About LoanTrack — Modern Loan Management Software',
  description:
    'LoanTrack is on a mission to bring modern, affordable loan tracking and management software to India\'s micro-lenders, NBFCs and chit-fund operators.',
  path: '/about-us',
  keywords: ['loan software company', 'lending software India', 'loan management system'],
});

const VALUES = [
  { ic: Heart, v: 'mk-ic--red', t: 'Built for the field', d: 'We design for the agent on a two-wheeler in the rain — speed, clarity and offline reliability come first.' },
  { ic: Shield, v: 'mk-ic--green', t: 'Trust by default', d: 'Financial data deserves serious security and RBI-aligned compliance, not afterthoughts.' },
  { ic: Target, v: 'mk-ic--amber', t: 'Honest simplicity', d: 'Powerful where it matters, simple everywhere else. No bloat, no lock-in, no surprises.' },
  { ic: Globe, v: 'mk-ic--blue', t: 'Local-first', d: 'Six languages, Indian payment rails and lending products built for how the market really works.' },
];

export default function AboutPage() {
  return (
    <>
      <BreadcrumbJsonLd name="About Us" path="/about-us" />
      <section className="mk-pagehero">
        <div className="mk-container">
          <span className="mk-eyebrow">About Us</span>
          <h1 className="mk-h1">Modern lending tech, for everyone</h1>
          <p className="mk-lead">
            We&apos;re building the platform we wished existed — one that gives small and
            mid-size lenders the same power the big players have, at a price that makes sense.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-split">
            <div>
              <span className="mk-eyebrow">Our mission</span>
              <h2 className="mk-h2">Level the playing field for India&apos;s lenders</h2>
              <p className="mk-lead" style={{ marginBottom: 16 }}>
                Millions of borrowers are served by micro-lenders, NBFCs and chit-fund
                operators running on paper, spreadsheets and disconnected apps. They deserve
                better — and so do their customers.
              </p>
              <p className="mk-lead">
                LoanTrack brings GPS-verified collection, multi-module lending and real
                accounting into one platform, so any lender can run a tight, transparent and
                compliant operation from day one.
              </p>
              <div className="mk-stat-band">
                <div><b>4</b><span>Lending modules</span></div>
                <div><b>6</b><span>Languages</span></div>
                <div><b>2</b><span>Mobile platforms</span></div>
              </div>
            </div>
            <div className="mk-feature-row__media">
              <div className="mk-card">
                <div className="mk-card__ic mk-ic--amber"><Zap /></div>
                <h3 className="mk-h3">From paper to platform</h3>
                <p>Everything a lending business needs — onboarding, disbursal, collection, wallets, accounting and analytics — connected and in sync.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="mk-section mk-section--soft">
        <div className="mk-container">
          <div className="mk-section-head">
            <span className="mk-eyebrow">What we believe</span>
            <h2 className="mk-h2">The principles behind the product</h2>
          </div>
          <div className="mk-grid mk-grid--4">
            {VALUES.map((v) => (
              <div className="mk-card" key={v.t}>
                <div className={`mk-card__ic ${v.v}`}><v.ic /></div>
                <h3 className="mk-h3" style={{ fontSize: '1.1rem' }}>{v.t}</h3>
                <p>{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Approach */}
      <section className="mk-section mk-section--dark">
        <div className="mk-container">
          <div className="mk-split">
            <div>
              <span className="mk-eyebrow">Our approach</span>
              <h2 className="mk-h2">Field-tested, not just feature-listed</h2>
              <p className="mk-lead">
                Every feature earns its place by solving a real problem for a real lender —
                from the agent collecting at a doorstep to the accountant closing the books.
                We ship fast, listen hard and keep the platform lean.
              </p>
            </div>
            <div className="mk-grid" style={{ gap: 16 }}>
              <div className="mk-card"><div className="mk-card__ic mk-ic--amber"><Users /></div><h3 className="mk-h3">Customer-led roadmap</h3><p>The lenders who use LoanTrack shape what we build next.</p></div>
              <div className="mk-card"><div className="mk-card__ic mk-ic--green"><Shield /></div><h3 className="mk-h3">Security &amp; compliance first</h3><p>RBI-aligned rules and serious data protection, baked in.</p></div>
            </div>
          </div>
        </div>
      </section>

      <CtaBand title="Let's build your lending business together" text="See why lenders are switching to a modern, all-in-one platform." />
    </>
  );
}
