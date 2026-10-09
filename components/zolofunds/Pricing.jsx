'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Check, ArrowRight, Sparkles } from 'lucide-react';
import { useScrollAnimation } from './hooks/useScrollAnimation';

export default function Pricing({ onOpenDemo }) {
  const sectionRef = useScrollAnimation();
  const [isYearly, setIsYearly] = useState(false);

  /**
   * ─── AUTHORITATIVE PRICING CATALOG ──────────────────────────────────────────
   * Source of Truth: Developer Portal (`/admin/billing/pricing`)
   * Table: SubscriptionPlanCatalog (Prisma)
   *
   * 4 Customer Plans: Free, Basic, Business (Most Popular), Enterprise
   * Add-ons are bundled into plans (lib/planFeatures.ts) with zero per-feature fees.
   * ─────────────────────────────────────────────────────────────────────────────
   */
  const DEFAULT_PLANS = [
    {
      id: 'free',
      plan: 'free',
      name: 'Free',
      monthlyPrice: 0,
      yearlyPrice: null,
      description: 'Test out LoanTrack features for free',
      branchesVal: '1',
      agentsVal: '1',
      loansVal: '25',
      trial: null,
      features: [
        'Single branch',
        '1 collection agent',
        '25 active loans',
        'Basic reporting & collection tracking',
        'Field agent mobile app access'
      ],
      cta: 'Start Free',
      popular: false
    },
    {
      id: 'basic',
      plan: 'basic',
      name: 'Basic',
      monthlyPrice: 799,
      yearlyPrice: 7689,
      description: 'Essential tools for small lending businesses',
      branchesVal: '2',
      agentsVal: '5',
      loansVal: '200',
      trial: '15-Day Free Trial',
      features: [
        'Up to 2 branches',
        'Up to 5 collection agents',
        'Up to 200 active loans',
        '15-day free trial included',
        'Aadhaar eKYC & Video KYC',
        'Preclose & Early Settlement',
        'Receipt PDF downloads & thermal printing',
        'Standard collection reporting'
      ],
      cta: 'Choose Basic',
      popular: false
    },
    {
      id: 'business',
      plan: 'business',
      name: 'Business',
      monthlyPrice: 1499,
      yearlyPrice: 16489,
      description: 'Advanced capabilities for growing operations',
      branchesVal: '5',
      agentsVal: '25',
      loansVal: '1,000',
      trial: '15-Day Free Trial',
      features: [
        'Up to 5 branches',
        'Up to 25 collection agents',
        'Up to 1,000 active loans',
        '15-day free trial included',
        'Everything in Basic, plus:',
        'WhatsApp & SMS alerts',
        'GPS collection & route tracking',
        'Multi-branch consolidation & analytics',
        'Priority email & chat support'
      ],
      cta: 'Choose Business',
      popular: true
    },
    {
      id: 'enterprise',
      plan: 'enterprise',
      name: 'Enterprise',
      monthlyPrice: 2999,
      yearlyPrice: 32989,
      description: 'Unlimited access for large-scale financial institutions',
      branchesVal: 'Unlimited',
      agentsVal: '9,999',
      loansVal: 'Unlimited',
      trial: '15-Day Free Trial',
      features: [
        'Unlimited branches',
        'Up to 9,999 collection agents',
        'Unlimited active loans',
        '15-day free trial included',
        'Everything in Business, plus:',
        'Credit bureau integration (CIBIL / CRIF)',
        'eNACH automated mandate collection',
        'Premium double-entry accounting & GST',
        'NPA classification engine',
        'Dedicated 24/7 SLA support'
      ],
      cta: 'Talk to Sales',
      popular: false
    }
  ];

  const [plans, setPlans] = useState(DEFAULT_PLANS);

  // Sync dynamically with Developer Portal live catalog
  useEffect(() => {
    let isMounted = true;
    fetch('/api/pricing', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted || !data?.success || !Array.isArray(data.plans) || data.plans.length === 0) return;
        const catalogPlans = data.plans;
        setPlans(
          DEFAULT_PLANS.map((dp) => {
            const found = catalogPlans.find((cp) => cp.plan === dp.plan);
            if (!found) return dp;
            return {
              ...dp,
              name: found.displayName || dp.name,
              description: found.description || dp.description,
              monthlyPrice: typeof found.monthlyPrice === 'number' ? found.monthlyPrice : dp.monthlyPrice,
              yearlyPrice: typeof found.yearlyPrice === 'number' ? found.yearlyPrice : dp.yearlyPrice,
              branchesVal: found.maxBranches === 999 ? 'Unlimited' : String(found.maxBranches),
              agentsVal: found.maxAgents === 9999 || found.maxAgents === 999 ? 'Unlimited' : String(found.maxAgents),
              loansVal: found.maxActiveLoans >= 999999 ? 'Unlimited' : found.maxActiveLoans.toLocaleString('en-IN'),
              trial: found.trialDays > 0 ? `${found.trialDays}-Day Free Trial` : null,
              features: Array.isArray(found.features) && found.features.length > 0 ? found.features : dp.features
            };
          })
        );
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * ─── VERTICAL MODULES ──────────────────────────────────────────────────────
   * Source: loanapp/lib/pricing.ts STANDARD_VERTICAL_BASES + seed-pricing.ts
   * Verticals are lending modules. Plan price applies per enabled vertical.
   * ─────────────────────────────────────────────────────────────────────────────
   */
  const verticalModules = [
    { name: 'Micro Lending', desc: 'Manage micro loans, daily collections, routes, and agents' },
    { name: 'Auto Finance', desc: 'Vehicle financing, hire purchase, collateral tracking, and hypothecation' },
    { name: 'Chit Funds', desc: 'Organize chit groups, auctions, dividend distribution, and member entries' },
    { name: 'Gold Loan', desc: 'Gold-backed lending, valuation, LTV, packets, pledges, and release tracking' },
    { name: 'Property Loan', desc: 'Property-backed lending, mortgage documents, valuation, and release tracking' },
    { name: 'Product Finance', desc: 'Consumer-durable and product financing with dealer and EMI tracking' }
  ];

  /**
   * ─── BUNDLED PLATFORM CAPABILITIES ──────────────────────────────────────────
   * Source: lib/planFeatures.ts + Developer Portal
   * All capabilities are bundled into subscription tiers — zero hidden per-feature fees.
   * ─────────────────────────────────────────────────────────────────────────────
   */
  const platformFeatures = [
    {
      name: 'Digital Aadhaar & Video KYC',
      tier: 'Included in Basic+',
      desc: 'Instant verification of customer identity with OTP matching and live selfie checks'
    },
    {
      name: 'Preclose & Early Settlement',
      tier: 'Included in Basic+',
      desc: 'Calculate precise early payoff amounts, discretionary waivers, and instant closing receipts'
    },
    {
      name: 'Receipt PDF & Thermal Printing',
      tier: 'Included in Basic+',
      desc: 'Issue digital collection receipts via PDF, Bluetooth thermal print, and download statements'
    },
    {
      name: 'WhatsApp & SMS Alerts',
      tier: 'Included in Business+',
      desc: 'Automated payment reminders, due-date alerts, OTPs, and collection SMS via MSG91'
    },
    {
      name: 'Agent Route GPS Tracking',
      tier: 'Included in Business+',
      desc: 'Real-time geo-stamp verification for field visits and automated route audits'
    },
    {
      name: 'Multi-Branch Consolidation',
      tier: 'Included in Business+',
      desc: 'Aggregate portfolio metrics across all branches with role-based access'
    },
    {
      name: 'Credit Bureau Integration',
      tier: 'Included in Enterprise',
      desc: 'Query CRIF / CIBIL / Equifax credit history directly for applicants before loan sanction'
    },
    {
      name: 'eNACH Automated Mandates',
      tier: 'Included in Enterprise',
      desc: 'Auto-debit recurring instalments straight from customer bank accounts via NPCI'
    },
    {
      name: 'Premium Double-Entry Accounting & GST',
      tier: 'Included in Enterprise',
      desc: 'Comprehensive General Ledger, Balance Sheet, P&L, GST summaries, and bank reconciliation'
    },
    {
      name: 'NPA Classification Engine',
      tier: 'Included in Enterprise',
      desc: 'Automated 90+ DPD overdue tagging, SMA buckets, regulatory provisioning, and recovery workflow'
    }
  ];

  return (
    <section id="pricing" className="section section-alt" ref={sectionRef}>
      <div className="container">
        <div className="section-header animate-on-scroll">
          <div className="section-pill">Lender Subscription Plans</div>
          <h2 className="section-title">
            Simple, Transparent <span className="gradient-text">Pricing for Lenders</span>
          </h2>
          <p className="section-subtitle">
            Start free and upgrade only when you need to. No setup fees, no lock-in — just transparent plans. All premium features are bundled with zero hidden add-on costs.
          </p>

          {/* Monthly / Yearly Billing Toggle */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#FFFFFF',
              border: '2px solid var(--brand-purple-border)',
              borderRadius: '9999px',
              padding: '4px',
              marginTop: '18px',
              boxShadow: '0 2px 8px rgba(107, 70, 193, 0.08)'
            }}
          >
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              style={{
                padding: '8px 20px',
                borderRadius: '9999px',
                border: 'none',
                background: !isYearly ? 'var(--brand-purple)' : 'transparent',
                color: !isYearly ? '#FFFFFF' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setIsYearly(true)}
              style={{
                padding: '8px 20px',
                borderRadius: '9999px',
                border: 'none',
                background: isYearly ? 'var(--brand-purple)' : 'transparent',
                color: isYearly ? '#FFFFFF' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <span>Yearly Billing</span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: isYearly ? '#FEF08A' : 'var(--brand-purple-tint)',
                  color: isYearly ? '#854D0E' : 'var(--brand-purple)'
                }}
              >
                Save up to 20%
              </span>
            </button>
          </div>
        </div>

        {/* 4 Authoritative Plans Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '24px',
            alignItems: 'stretch',
            marginBottom: '40px'
          }}
        >
          {plans.map((p, pi) => {
            const isFree = p.monthlyPrice === 0;
            const displayPrice = isYearly && p.yearlyPrice
              ? `₹${p.yearlyPrice.toLocaleString('en-IN')}`
              : isFree
              ? '₹0'
              : `₹${p.monthlyPrice.toLocaleString('en-IN')}`;

            const periodLabel = isFree
              ? 'forever'
              : isYearly && p.yearlyPrice
              ? '/yr + GST'
              : '/mo + GST';

            const effectiveMonthly = isYearly && p.yearlyPrice
              ? `₹${Math.round(p.yearlyPrice / 12).toLocaleString('en-IN')}/mo billed annually`
              : null;

            return (
              <div
                key={p.id}
                className={`glass-card animate-on-scroll delay-${pi + 1}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '32px 24px',
                  borderRadius: '22px',
                  border: p.popular
                    ? '3px solid var(--brand-purple)'
                    : '1.5px solid var(--border-color)',
                  position: 'relative',
                  background: '#FFFFFF',
                  boxShadow: p.popular ? 'var(--shadow-purple)' : 'var(--shadow-sm)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-purple)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = p.popular ? 'var(--shadow-purple)' : 'var(--shadow-sm)';
                }}
              >
                {/* Most Popular Badge */}
                {p.popular && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '14px',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      background: 'var(--brand-purple)',
                      color: '#FFFFFF',
                      fontSize: '0.7rem',
                      fontWeight: 900,
                      letterSpacing: '0.04em'
                    }}
                  >
                    MOST POPULAR
                  </div>
                )}

                {/* Free Trial Badge (if not already popular) */}
                {!p.popular && p.trial && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '14px',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      background: '#FEF08A',
                      color: '#854D0E',
                      fontSize: '0.7rem',
                      fontWeight: 800
                    }}
                  >
                    {p.trial}
                  </div>
                )}

                <div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--brand-purple)', marginBottom: '4px' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', minHeight: '38px', lineHeight: 1.4, marginBottom: '16px' }}>
                    {p.description}
                  </div>

                  {/* Price */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: effectiveMonthly ? '4px' : '18px' }}>
                    <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-title)', lineHeight: 1 }}>
                      {displayPrice}
                    </span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      {periodLabel}
                    </span>
                  </div>

                  {effectiveMonthly && (
                    <div style={{ fontSize: '0.76rem', color: 'var(--brand-purple)', fontWeight: 700, marginBottom: '16px' }}>
                      ⚡ {effectiveMonthly}
                    </div>
                  )}

                  {/* Resource Capacities from Developer Portal */}
                  <div
                    style={{
                      background: 'var(--bg-subtle)',
                      borderRadius: '12px',
                      padding: '10px 12px',
                      marginBottom: '18px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '4px',
                      textAlign: 'center',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.03em' }}>
                        Branches
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 900, color: 'var(--text-title)', marginTop: '2px' }}>
                        {p.branchesVal}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.03em' }}>
                        Agents
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 900, color: 'var(--text-title)', marginTop: '2px' }}>
                        {p.agentsVal}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.03em' }}>
                        Loans
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 900, color: 'var(--text-title)', marginTop: '2px' }}>
                        {p.loansVal}
                      </div>
                    </div>
                  </div>

                  <div style={{ height: '1.5px', background: 'var(--border-subtle)', marginBottom: '18px' }} />

                  {/* Features List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                    {p.features.map((feat, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: 'var(--brand-purple-tint)',
                            color: 'var(--brand-purple)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            flexShrink: 0,
                            marginTop: '2px'
                          }}
                        >
                          <Check size={11} />
                        </div>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-body)', lineHeight: 1.45, fontWeight: 500 }}>
                          {feat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {p.id === 'enterprise' ? (
                  <button
                    onClick={onOpenDemo}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px', fontSize: '0.9rem', justifyContent: 'center' }}
                  >
                    <span>{p.cta}</span>
                    <ArrowRight size={15} />
                  </button>
                ) : (
                  <Link
                    href={`/register?plan=${p.plan}`}
                    className={p.popular ? 'btn btn-primary' : 'btn btn-secondary'}
                    style={{ width: '100%', padding: '12px', fontSize: '0.9rem', justifyContent: 'center' }}
                  >
                    <span>{p.cta}</span>
                    <ArrowRight size={15} />
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* Pricing Model Explainer */}
        <div
          style={{
            background: 'var(--brand-purple-light)',
            border: '2px solid var(--brand-purple-border)',
            borderRadius: '18px',
            padding: '24px 28px',
            marginBottom: '36px',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--brand-purple)', marginBottom: '6px' }}>
            📐 Per-Vertical Pricing Model
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-body)', lineHeight: 1.6, maxWidth: '800px', margin: '0 auto' }}>
            Your subscription plan price applies <strong>per lending vertical</strong> you enable. For example, if you choose the Business plan (₹1,499/mo) and enable both Micro Lending and Auto Finance, your vertical subscription is ₹1,499 × 2 = ₹2,998/mo. All premium capabilities are bundled with zero add-on charges.
          </p>
        </div>

        {/* GST Transparency Banner */}
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '44px' }}>
          All paid plans billed in INR + 18% GST. Billing is available monthly or annually via Razorpay. Cancel anytime.
        </p>

        {/* 6 Lending Verticals Section */}
        <div
          className="glass-card"
          style={{
            padding: '36px',
            border: '2px solid var(--brand-purple-border)',
            background: '#FFFFFF',
            borderRadius: '24px',
            marginBottom: '28px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="zolo-pill-badge">6 Lending Verticals</span>
          </div>
          <h3 style={{ fontSize: '1.45rem', marginBottom: '6px', color: 'var(--text-title)' }}>
            Choose Your Lending Modules
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '24px' }}>
            Each vertical operates under your chosen subscription tier. Enable or disable modules per branch at any time as your business expands.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '14px'
            }}
          >
            {verticalModules.map((mod, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--bg-subtle)',
                  padding: '16px',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}
              >
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'var(--brand-purple)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.65rem',
                    flexShrink: 0,
                    marginTop: '3px'
                  }}
                >
                  <Check size={10} />
                </div>
                <div>
                  <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-title)', marginBottom: '2px' }}>
                    {mod.name}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45, margin: 0 }}>
                    {mod.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bundled Capabilities Section */}
        <div
          className="glass-card"
          style={{
            padding: '36px',
            border: '2px solid var(--brand-purple-border)',
            background: '#FFFFFF',
            borderRadius: '24px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="zolo-pill-badge">Bundled Platform Capabilities</span>
            <Sparkles size={16} color="var(--brand-purple)" />
          </div>
          <h3 style={{ fontSize: '1.45rem', marginBottom: '6px', color: 'var(--text-title)' }}>
            All-Inclusive Feature Bundles
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '24px' }}>
            Advanced lending features are included directly inside your plan tier with zero hidden per-feature fees.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px'
            }}
          >
            {platformFeatures.map((feat, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--bg-subtle)',
                  padding: '18px',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-title)' }}>
                      {feat.name}
                    </div>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        color: 'var(--brand-purple)',
                        background: 'var(--brand-purple-light)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--brand-purple-border)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {feat.tier}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45, margin: 0 }}>
                    {feat.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
