import Link from 'next/link';
import CtaBand from '../_components/CtaBand';
import {
  Arrow, CheckCircle, MapPin, Wallet, Shield, Chart, Bell, Layers,
  Coins, Car, Gem, Users, Smartphone, Globe, Zap, Book,
} from '../_components/icons';

import { buildMetadata } from '../_components/seo';

export const metadata = buildMetadata({
  title: 'Loan Tracking Software for Micro-Lenders & NBFCs',
  description:
    'ZoloFund is all-in-one loan tracking and management software — run micro-lending, auto finance, gold loans and chit funds with GPS field collection, agent wallets, KYC and accounting. Free plan, 6 languages.',
  path: '/home',
  keywords: ['loan tracking software', 'loan management software', 'microfinance software', 'field collection app'],
});

const FEATURES = [
  { ic: MapPin, v: 'mk-ic--amber', t: 'GPS Field Collection', d: 'Every collection is geo-stamped with live agent tracking and route check-ins — proof of visit on every rupee collected.' },
  { ic: Layers, v: 'mk-ic--blue', t: 'Four Lending Modules', d: 'Micro lending, auto finance, gold loan and chit funds — enable any combination per branch from a single dashboard.' },
  { ic: Wallet, v: 'mk-ic--green', t: 'Agent Wallets & Cash Pool', d: 'Track agent float, branch cash pools and handovers with a reconciliation ledger that always balances.' },
  { ic: Book, v: 'mk-ic--purple', t: 'Premium Accounting', d: 'Full double-entry GL, journals, bank reconciliation, P&L and period locks — not just an expense tracker.' },
  { ic: Shield, v: 'mk-ic--red', t: 'KYC & Compliance', d: 'Aadhaar eKYC, Video KYC, credit bureau pulls and NPA auto-classification aligned to RBI norms.' },
  { ic: Chart, v: 'mk-ic--amber', t: 'Live Analytics', d: 'Portfolio trends, collection efficiency and agent performance — decision-ready dashboards in real time.' },
];

const MODULES = [
  { ic: Coins, v: 'mk-ic--amber', t: 'Micro Lending', d: 'Daily, weekly and monthly small-ticket loans with smart instalment scheduling and penalty waterfalls.' },
  { ic: Car, v: 'mk-ic--blue', t: 'Auto Finance', d: 'Vehicle-backed loans with collateral registry, condition photos and repossession flags.' },
  { ic: Gem, v: 'mk-ic--purple', t: 'Gold Loan', d: 'Gold-collateral lending with valuation, redemption tracking and auction management.' },
  { ic: Users, v: 'mk-ic--green', t: 'Chit Funds', d: 'Group management, auction winner recording and dividend distribution per member.' },
];

export default function HomePage() {
  return (
    <>
      {/* ---- Hero ---- */}
      <section className="mk-hero">
        <div className="mk-hero__bg" />
        <div className="mk-hero__grid" />
        <div className="mk-container mk-hero__inner">
          <div>
            <span className="mk-hero__badge">
              <span>NEW</span> Native mobile app for field agents
            </span>
            <h1 className="mk-h1">
              Field collection &amp; lending,{' '}
              <span className="mk-grad-text">finally in one place.</span>
            </h1>
            <p className="mk-lead">
              ZoloFund unifies micro-lending, auto finance, gold loans and chit funds —
              with GPS-verified collection, agent wallets and full accounting. Built for
              India&apos;s lenders, in six languages.
            </p>
            <div className="mk-hero__actions">
              <Link href="/contact" className="mk-btn mk-btn--primary mk-btn--lg">
                Request a Demo <Arrow />
              </Link>
              <Link href="/products" className="mk-btn mk-btn--ghost mk-btn--lg">
                Explore the Platform
              </Link>
            </div>
            <div className="mk-hero__note">
              <div><CheckCircle /> Free plan, no card</div>
              <div><CheckCircle /> 6 Indian languages</div>
              <div><CheckCircle /> RBI-aligned NPA rules</div>
            </div>
          </div>

          {/* Stylised product mock */}
          <div className="mk-hero__visual">
            <div className="mk-mock">
              <div className="mk-mock__bar">
                <span className="mk-mock__dot" /><span className="mk-mock__dot" /><span className="mk-mock__dot" />
              </div>
              <div className="mk-mock__body">
                <div className="mk-mock__kpis">
                  <div className="mk-mock__kpi"><small>Today&apos;s Collection</small><b>₹2,48,500</b> <i className="mk-up">▲ 12.4%</i></div>
                  <div className="mk-mock__kpi"><small>Active Loans</small><b>1,420</b> <i className="mk-up">▲ 3.1%</i></div>
                  <div className="mk-mock__kpi"><small>Overdue (NPA)</small><b>₹84,200</b> <i className="mk-down">▼ 5.7%</i></div>
                  <div className="mk-mock__kpi"><small>Collection Rate</small><b>96.2%</b> <i className="mk-up">▲ 1.8%</i></div>
                </div>
                <div className="mk-mock__chart">
                  {[42, 60, 38, 72, 55, 88, 64, 95, 70, 82].map((h, i) => (
                    <span key={i} className="mk-mock__bar-col" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="mk-float mk-float--a">
              <span className="mk-float__ic mk-ic--green"><MapPin /></span>
              <div><b>GPS verified</b><small>Route A · 14 stops</small></div>
            </div>
            <div className="mk-float mk-float--b">
              <span className="mk-float__ic mk-ic--amber"><Wallet /></span>
              <div><b>₹38,900</b><small>Agent float settled</small></div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Trust band ---- */}
      <div className="mk-trust">
        <div className="mk-container">
          <p>Built for every kind of lender</p>
          <div className="mk-trust__row">
            <span className="mk-trust__item"><Coins /> Micro-Lenders</span>
            <span className="mk-trust__item"><Shield /> NBFCs</span>
            <span className="mk-trust__item"><Users /> Chit Companies</span>
            <span className="mk-trust__item"><Gem /> Gold Financiers</span>
            <span className="mk-trust__item"><Car /> Auto Financiers</span>
          </div>
        </div>
      </div>

      {/* ---- Stats ---- */}
      <section className="mk-section mk-section--tight">
        <div className="mk-container">
          <div className="mk-stats">
            <div className="mk-stat"><b className="mk-grad-text">4</b><span>Lending modules in one platform</span></div>
            <div className="mk-stat"><b className="mk-grad-text">6</b><span>Indian languages supported</span></div>
            <div className="mk-stat"><b className="mk-grad-text">96%</b><span>Average collection efficiency</span></div>
            <div className="mk-stat"><b className="mk-grad-text">100%</b><span>GPS-verified collections</span></div>
          </div>
        </div>
      </section>

      {/* ---- Features ---- */}
      <section className="mk-section mk-section--soft" id="features">
        <div className="mk-container">
          <div className="mk-section-head">
            <span className="mk-eyebrow">Everything in one platform</span>
            <h2 className="mk-h2">A complete lending operating system</h2>
            <p className="mk-lead">
              From the agent in the field to the books at head office — every part of your
              lending business, connected and in sync.
            </p>
          </div>
          <div className="mk-grid mk-grid--3">
            {FEATURES.map((f) => (
              <div className="mk-card" key={f.t}>
                <div className={`mk-card__ic ${f.v}`}><f.ic /></div>
                <h3 className="mk-h3">{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Modules ---- */}
      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-section-head">
            <span className="mk-eyebrow">Multi-module lending</span>
            <h2 className="mk-h2">Run every product you offer</h2>
            <p className="mk-lead">Enable the modules you need, per branch. Switch on more as you grow.</p>
          </div>
          <div className="mk-grid mk-grid--4">
            {MODULES.map((m) => (
              <div className="mk-card" key={m.t}>
                <div className={`mk-card__ic ${m.v}`}><m.ic /></div>
                <h3 className="mk-h3">{m.t}</h3>
                <p>{m.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section className="mk-section mk-section--dark">
        <div className="mk-container">
          <div className="mk-section-head">
            <span className="mk-eyebrow">How it works</span>
            <h2 className="mk-h2">Live in four steps</h2>
          </div>
          <div className="mk-steps">
            <div className="mk-step"><div className="mk-step__n">1</div><h3>Onboard customers</h3><p>Multi-step KYC with Aadhaar eKYC, photo capture and credit bureau checks.</p></div>
            <div className="mk-step"><div className="mk-step__n">2</div><h3>Disburse loans</h3><p>Configure terms, generate schedules and approve through built-in workflows.</p></div>
            <div className="mk-step"><div className="mk-step__n">3</div><h3>Collect in the field</h3><p>Agents collect with GPS proof, QR payments and instant digital receipts.</p></div>
            <div className="mk-step"><div className="mk-step__n">4</div><h3>Reconcile &amp; report</h3><p>Wallets settle, the ledger balances and reports export in one click.</p></div>
          </div>
        </div>
      </section>

      {/* ---- Mobile highlight ---- */}
      <section className="mk-section mk-section--soft">
        <div className="mk-container">
          <div className="mk-feature-row">
            <div>
              <span className="mk-eyebrow">In the field</span>
              <h2 className="mk-h2">A mobile app your agents will actually use</h2>
              <p className="mk-lead">
                Biometric login, offline-first collection, GPS check-ins and push reminders —
                purpose-built for daily field work on Android and iOS.
              </p>
              <ul className="mk-checklist">
                <li><CheckCircle /> Offline collection that syncs the moment you reconnect</li>
                <li><CheckCircle /> Geo-stamped receipts and live route tracking</li>
                <li><CheckCircle /> QR-code payment proof and instant statements</li>
                <li><CheckCircle /> Secure JWT auth with biometric unlock</li>
              </ul>
            </div>
            <div className="mk-feature-row__media">
              <div className="mk-card">
                <div className="mk-card__ic mk-ic--amber"><Smartphone /></div>
                <h3 className="mk-h3">Agent Mobile App</h3>
                <p>Designed for speed and one-handed use — the most-used screen on every route.</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                  <span className="mk-trust__item" style={{ fontSize: '0.85rem' }}><Globe /> Android</span>
                  <span className="mk-trust__item" style={{ fontSize: '0.85rem' }}><Zap /> iOS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Testimonial ---- */}
      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-quote">
            <div className="mk-quote__mark">&ldquo;</div>
            <p>We replaced three tools with ZoloFund. GPS collection and the agent wallet alone cut our daily reconciliation from hours to minutes.</p>
            <div className="mk-quote__who">
              <span className="mk-quote__av">RK</span>
              <div style={{ textAlign: 'left' }}>
                <b>Branch Operations Lead</b>
                <small>Regional micro-finance lender</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
